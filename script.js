// Simple, stable application script
const APP_VERSION = '1.4.0';

// Global variables
let map;
let markers;
let municipalityLayer;
let userLocationCircle;
let userLocationMarker;
let currentFilter = {};
let locationWatchId;
let pIcon, bIcon;
let hoverLabel;
let municipalities = [];
let translations = {};
let currentLanguage = 'nl';

// Filter state management
let filterState = {
  checkedTypes: ['Project', 'Bedrijf'],
  checkedFilters: {},
  userLocation: null,
  radius: 25
};

// Page detection
const isMapPage = window.location.pathname === '/' || 
                  window.location.pathname === '/index.html' ||
                  window.location.pathname.endsWith('/');

// Cache management
function clearAllCaches() {
  if ('caches' in window) {
    caches.keys().then(cacheNames => {
      cacheNames.forEach(cacheName => {
        if (cacheName.startsWith('hbm-kansenkaart-')) {
          caches.delete(cacheName);
        }
      });
    });
  }
  localStorage.removeItem('hbm_app_version');
}

// Service worker registration
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('SW registered:', registration.scope);

        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              showUpdateNotification();
            }
          });
        });
      })
      .catch(error => console.log('SW registration failed:', error));
  }
}

function showUpdateNotification() {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: rgb(38, 123, 41);
    color: white;
    padding: 16px;
    border-radius: 8px;
    z-index: 10000;
    font-size: 14px;
    max-width: 300px;
  `;

  notification.innerHTML = `
    <div style="margin-bottom: 12px;"><strong>Update beschikbaar</strong></div>
    <button onclick="window.location.reload()" style="
      background: white; 
      color: rgb(38, 123, 41); 
      border: none; 
      padding: 8px 16px; 
      border-radius: 4px; 
      cursor: pointer;
    ">Vernieuwen</button>
  `;

  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 10000);
}

// Version check
function checkVersion() {
  const currentVersion = localStorage.getItem('hbm_app_version');
  if (currentVersion !== APP_VERSION) {
    console.log(`Version update: ${currentVersion} -> ${APP_VERSION}`);
    clearAllCaches();
    localStorage.setItem('hbm_app_version', APP_VERSION);
  }
}

// Language system
async function loadTranslations() {
  try {
    const response = await fetch(`/translations/${currentLanguage}.json?v=${APP_VERSION}`);
    translations = await response.json();
  } catch (error) {
    console.warn('Failed to load translations:', error);
    translations = {};
  }
}

function t(key) {
  return translations[key] || key;
}

// Map initialization
function initMap() {
  map = L.map('map', {
    center: [51.2, 6.0],
    zoom: 8,
    zoomControl: false,
    scrollWheelZoom: true,
    doubleClickZoom: true,
    attributionControl: false
  });

  L.control.zoom({ position: 'bottomright' }).addTo(map);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap contributors © CARTO',
    maxZoom: 18
  }).addTo(map);

  municipalityLayer = L.layerGroup();

  const layerControl = L.control.layers({}, {
    'Gemeentegrenzen': municipalityLayer
  }, { position: 'topright' }).addTo(map);

  // Initialize markers
  markers = L.markerClusterGroup({
    disableClusteringAtZoom: 15,
    maxClusterRadius: 50,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true
  });

  map.addLayer(markers);

  // Initialize icons
  pIcon = L.icon({
    iconUrl: '/icons/marker-project.svg',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });

  bIcon = L.icon({
    iconUrl: '/icons/marker-company.svg',
    iconSize: [32, 32], 
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });
}

// Data loading
async function loadData() {
  try {
    console.log('Loading data...');
    const response = await fetch(`/data/opportunities.json?v=${APP_VERSION}`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const data = await response.json();
    if (!Array.isArray(data)) {
      console.error('Data is not an array:', data);
      return [];
    }

    console.log('Data loaded successfully:', data.length, 'items');
    return data;
  } catch (error) {
    console.error('Error loading data:', error);
    return [];
  }
}

// Create markers
function createMarkers(data) {
  if (!markers) return;

  markers.clearLayers();
  console.log('Creating markers for', data.length, 'items');

  let markerCount = 0;
  data.forEach(item => {
    if (item.Latitude && item.Longitude) {
      const icon = item.HBMType === 'Project' ? pIcon : bIcon;
      const marker = L.marker([item.Latitude, item.Longitude], { icon: icon });

      const popupContent = createPopupContent(item);
      marker.bindPopup(popupContent, {
        maxWidth: 300,
        className: 'custom-popup'
      });

      marker.itemData = item;
      markers.addLayer(marker);
      markerCount++;
    }
  });

  console.log(`Created ${markerCount} markers`);
}

function createPopupContent(item) {
  return `
    <div class="popup-content">
      <h3>${item.Name || 'Onbekend'}</h3>
      <div class="popup-type">
        <span class="type-badge ${item.HBMType?.toLowerCase() || 'unknown'}">${item.HBMType || 'Onbekend'}</span>
      </div>
      ${item.Logo ? `<img src="${item.Logo}" alt="Logo" class="popup-logo" onerror="this.style.display='none'">` : ''}
      ${item.ProjectImage ? `<img src="${item.ProjectImage}" alt="Project" class="popup-image" onerror="this.style.display='none'">` : ''}
      <div class="popup-details">
        ${item.ProjectType ? `<p><strong>Project Type:</strong> ${formatArray(item.ProjectType)}</p>` : ''}
        ${item.OrganizationType ? `<p><strong>Organisatie:</strong> ${item.OrganizationType}</p>` : ''}
        ${item.HBMTopic ? `<p><strong>HBM Onderwerp:</strong> ${formatArray(item.HBMTopic)}</p>` : ''}
        ${item.Description ? `<p class="description">${item.Description}</p>` : ''}
      </div>
      <div class="popup-actions">
        <button onclick="showDetails('${encodeURIComponent(item.Name || '')}')" class="card-contact-btn">Meer info</button>
      </div>
    </div>
  `;
}

// Location functions
function getCurrentLocation() {
  if (!navigator.geolocation) {
    alert('Geolocatie wordt niet ondersteund door deze browser.');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    position => {
      const { latitude, longitude } = position.coords;

      currentFilter.userLocation = { lat: latitude, lng: longitude };
      filterState.userLocation = { lat: latitude, lng: longitude };

      const distanceRange = document.getElementById('distanceRange');
      const radius = distanceRange ? parseInt(distanceRange.value) : 25;
      currentFilter.radius = radius * 1000;
      filterState.radius = radius;

      map.setView([latitude, longitude], 12);

      // Remove existing location markers
      if (userLocationCircle) map.removeLayer(userLocationCircle);
      if (userLocationMarker) map.removeLayer(userLocationMarker);

      // Add user location marker
      userLocationMarker = L.marker([latitude, longitude], {
        icon: L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34]
        })
      }).addTo(map).bindPopup('Uw locatie');

      // Add radius circle
      userLocationCircle = L.circle([latitude, longitude], {
        color: '#3388ff',
        fillColor: '#3388ff',
        fillOpacity: 0.2,
        radius: radius * 1000
      }).addTo(map);

      // Update UI
      const distanceFilter = document.getElementById('distanceFilter');
      if (distanceFilter) distanceFilter.style.display = 'block';

      const locationBtn = document.getElementById('useMyLocation');
      if (locationBtn) {
        locationBtn.innerHTML = '<span>📍 Locatie actief</span>';
        locationBtn.classList.add('active');
      }

      const clearLocationBtn = document.getElementById('clearLocation');
      if (clearLocationBtn) clearLocationBtn.style.display = 'block';

      applyFilters();
    },
    error => {
      console.error('Error getting location:', error);
      alert('Kon locatie niet bepalen. Controleer je browser instellingen.');
    }
  );
}

function clearLocation() {
  currentFilter.userLocation = null;
  filterState.userLocation = null;

  if (userLocationCircle) map.removeLayer(userLocationCircle);
  if (userLocationMarker) map.removeLayer(userLocationMarker);

  const distanceFilter = document.getElementById('distanceFilter');
  if (distanceFilter) distanceFilter.style.display = 'none';

  const locationBtn = document.getElementById('useMyLocation');
  if (locationBtn) {
    locationBtn.innerHTML = '<span>📍 Gebruik mijn locatie</span>';
    locationBtn.classList.remove('active');
  }

  const clearLocationBtn = document.getElementById('clearLocation');
  if (clearLocationBtn) clearLocationBtn.style.display = 'none';

  applyFilters();
}

// Filter functions
function applyFilters() {
  if (!window.data || !Array.isArray(window.data)) {
    console.warn('No data available for filtering');
    return;
  }

  markers.clearLayers();

  const checkedTypes = Array.from(document.querySelectorAll('input[name="HBMType"]:checked')).map(cb => cb.value);

  const filteredData = window.data.filter(item => {
    if (checkedTypes.length > 0 && !checkedTypes.includes(item.HBMType)) {
      return false;
    }

    if (currentFilter.userLocation && currentFilter.radius) {
      const distance = calculateDistance(
        currentFilter.userLocation.lat,
        currentFilter.userLocation.lng,
        item.Latitude,
        item.Longitude
      );
      if (distance > currentFilter.radius) return false;
    }

    return true;
  });

  createMarkers(filteredData);
  updateListView(filteredData);
  updateResultCount(filteredData.length);
}

function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function formatArray(value) {
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  return value || '';
}

function updateResultCount(count) {
  const resultElement = document.getElementById('resultsCount');
  if (resultElement) {
    resultElement.textContent = `${count} resultaten`;
  }
}

function updateListView(data) {
  const buildingsList = document.getElementById('opportunitiesList');
  const companiesList = document.getElementById('companiesList');

  if (!buildingsList || !companiesList) return;

  const projects = data.filter(item => item.HBMType === 'Project');
  const companies = data.filter(item => item.HBMType === 'Bedrijf');

  buildingsList.innerHTML = projects.length === 0 ? 
    '<div class="no-results-opportunity"><h2>Geen projecten gevonden</h2></div>' :
    projects.map(item => createListItemHTML(item)).join('');

  companiesList.innerHTML = companies.length === 0 ?
    '<div class="no-results-opportunity"><h2>Geen bedrijven gevonden</h2></div>' :
    companies.map(item => createListItemHTML(item)).join('');
}

function createListItemHTML(item) {
  return `
    <div class="opportunity-card">
      <div class="card-header">
        <h3 class="card-title">${item.Name || 'Onbekend'}</h3>
        <span class="card-type-badge ${item.HBMType?.toLowerCase() || 'unknown'}">${item.HBMType || 'Onbekend'}</span>
      </div>
      ${item.Logo ? `<img src="${item.Logo}" alt="Logo" class="card-logo" onerror="this.style.display='none'">` : ''}
      ${item.Description ? `<p class="card-description">${item.Description}</p>` : ''}
    </div>
  `;
}

// UI initialization
function initializeUI() {
  // Filter overlay
  const filterBtn = document.getElementById('filterBtn');
  const filterOverlay = document.getElementById('filterOverlay');
  const closeFiltersBtn = document.getElementById('closeFilters');

  if (filterBtn && filterOverlay) {
    filterBtn.addEventListener('click', () => filterOverlay.classList.add('open'));
  }

  if (closeFiltersBtn && filterOverlay) {
    closeFiltersBtn.addEventListener('click', () => filterOverlay.classList.remove('open'));
  }

  // Location buttons
  const locationBtn = document.getElementById('useMyLocation');
  const clearLocationBtn = document.getElementById('clearLocation');

  if (locationBtn) {
    locationBtn.addEventListener('click', getCurrentLocation);
  }

  if (clearLocationBtn) {
    clearLocationBtn.addEventListener('click', clearLocation);
  }

  // Distance slider
  const distanceRange = document.getElementById('distanceRange');
  const distanceValue = document.getElementById('distanceValue');

  if (distanceRange && distanceValue) {
    distanceRange.addEventListener('input', function() {
      const value = parseInt(this.value);
      distanceValue.textContent = value + ' km';

      if (currentFilter.userLocation) {
        currentFilter.radius = value * 1000;
        filterState.radius = value;

        if (userLocationCircle) {
          userLocationCircle.setRadius(value * 1000);
        }

        applyFilters();
      }
    });
  }

  // Filter form
  const filterForm = document.getElementById('filtersForm');
  if (filterForm) {
    filterForm.addEventListener('change', function(e) {
      if (e.target.type === 'checkbox') {
        applyFilters();
      }
    });
  }

  // Hamburger menu
  const hamburger = document.getElementById('hamburger');
  const menuOverlay = document.getElementById('menuOverlay');
  const closeMenu = document.getElementById('closeMenu');

  if (hamburger && menuOverlay) {
    hamburger.addEventListener('click', () => menuOverlay.classList.add('open'));
  }

  if (closeMenu && menuOverlay) {
    closeMenu.addEventListener('click', () => menuOverlay.classList.remove('open'));
  }

  // List view toggle
  const viewToggle = document.getElementById('viewToggle');
  const listContainer = document.querySelector('.list-container');

  if (viewToggle && listContainer) {
    viewToggle.addEventListener('click', function() {
      listContainer.classList.toggle('show');
      const isShowing = listContainer.classList.contains('show');
      viewToggle.querySelector('#viewToggleText').textContent = isShowing ? 'Kaart' : 'Lijst';
    });
  }

  // Tabs
  const tabButtons = document.querySelectorAll('.list-tab');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      const targetTab = this.getAttribute('data-tab');

      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabPanes.forEach(pane => pane.classList.remove('active'));

      this.classList.add('active');
      const targetPane = document.getElementById(targetTab + 'Tab');
      if (targetPane) {
        targetPane.classList.add('active');
      }
    });
  });
}

// Global functions
function showDetails(itemName) {
  const decodedName = decodeURIComponent(itemName);
  const item = window.data.find(d => d.Name === decodedName);
  if (item) {
    alert(`Details voor ${decodedName} - Deze functie wordt binnenkort uitgebreid.`);
  }
}

// Main initialization
async function initializeApp() {
  try {
    console.log('Initializing HBM Kansenkaart v' + APP_VERSION);

    // Check version and clear old caches
    checkVersion();

    // Load translations
    await loadTranslations();

    // Initialize UI
    initializeUI();

    // Register service worker
    registerServiceWorker();

    if (isMapPage) {
      // Wait for Leaflet to be available
      if (typeof L === 'undefined') {
        console.log('Waiting for Leaflet to load...');
        const checkLeaflet = setInterval(() => {
          if (typeof L !== 'undefined') {
            clearInterval(checkLeaflet);
            initializeMapApp();
          }
        }, 100);
      } else {
        initializeMapApp();
      }
    }

    console.log('Application initialized successfully');
  } catch (error) {
    console.error('Error initializing application:', error);
  }
}

async function initializeMapApp() {
  try {
    // Initialize map
    initMap();

    // Load and process data
    const data = await loadData();
    window.data = data;

    // Create initial markers
    createMarkers(data);

    // Apply initial filters
    applyFilters();

    // Show legend
    const legend = document.getElementById('mapLegend');
    if (legend) legend.style.display = 'block';

    console.log('Map application initialized with', data.length, 'items');
  } catch (error) {
    console.error('Error initializing map:', error);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

// Export for global access
window.showDetails = showDetails;
window.getCurrentLocation = getCurrentLocation;
window.clearLocation = clearLocation;