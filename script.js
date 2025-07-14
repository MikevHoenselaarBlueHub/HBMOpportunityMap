// Import configuration and utilities
import { mapConfig, dataPaths, translationPaths } from './config/map-config.js';
import { calculateDistance, formatArray, debounce, isValidCoordinate, generateId, sanitizeHtml } from './config/utils.js';

// Global variables
let map;
let markers = L.markerClusterGroup(mapConfig.cluster);
let municipalityLayer;
let userLocationCircle;
let currentFilter = {};
let locationWatchId;
let pIcon, bIcon;
let hoverLabel;
let municipalities = [];
let translations = {};
let currentLanguage = 'nl';

// Determine page type
const isMapPage = window.location.pathname === '/' || window.location.pathname === '/index.html';
const isInfoPage = window.location.pathname.includes('info.html');
const isOverPage = window.location.pathname.includes('over.html');

// Only initialize map on the main page
if (isMapPage && !isInfoPage && !isOverPage) {
  // Function to initialize everything when Leaflet is ready
  async function initializeApp() {
    if (typeof L !== 'undefined') {
      // Load translations first
      await loadTranslations();

      // Initialize icons using config
      pIcon = L.icon(mapConfig.markers.project);
      bIcon = L.icon(mapConfig.markers.company);

      // Create hover label
      createHoverLabel();

      // Initialize tabs
      initializeTabs();

      // Track page view
      trackPageView('Kansenkaart');

      // Register service worker for offline support
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
          .then(registration => {
            console.log('Service Worker registered:', registration.scope);
          })
          .catch(error => {
            console.log('Service Worker registration failed:', error);
          });
      }

      // Data laden using config
      fetch(dataPaths.opportunities)
        .then(res => {
          if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
          }
          return res.json();
        })
        .then(async data => {
          // Ensure data is an array
          if (!Array.isArray(data)) {
            console.error('Data is not an array:', data);
            data = [];
          }

          // Process data and geocode missing coordinates
          window.data = await processDataWithGeocoding(data);

          // Initialize map after data is loaded
          initMap();

          // Load municipality boundaries
          loadMunicipalityBoundaries();

          // Create markers
          createMarkers(window.data);

          // Apply initial filters
          applyFilters();

          // Initialize auto complete
          initAutocomplete(window.data);
        })
        .catch(error => {
          console.error('Error loading data:', error);
          // Initialize empty data array
          window.data = [];
          // Initialize map even if data fails to load
          initMap();
          loadMunicipalityBoundaries();
        });
    } else {
      console.error('Leaflet not loaded');
    }
  }

  // Initialize the app
  document.addEventListener('DOMContentLoaded', function() {
    // Wait for Leaflet to load
    const checkLeaflet = setInterval(() => {
      if (typeof L !== 'undefined') {
        console.log('Leaflet loaded successfully');
        clearInterval(checkLeaflet);

        // Wait for MarkerCluster
        const checkMarkerCluster = setInterval(() => {
          if (typeof L.markerClusterGroup !== 'undefined') {
            console.log('MarkerCluster loaded successfully');
            clearInterval(checkMarkerCluster);
            initializeApp();
          }
        }, 100);
      }
    }, 100);
  });
}

// Geocoding functions
async function geocodeAddress(street, zip, city) {
  if (!street && !zip && !city) {
    return null;
  }

  // Build address string
  const addressParts = [];
  if (street) addressParts.push(street);
  if (zip) addressParts.push(zip);
  if (city) addressParts.push(city);

  const address = addressParts.join(', ');

  try {
    // Use Nominatim OpenStreetMap geocoding service
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`);
    const results = await response.json();

    if (results && results.length > 0) {
      return {
        lat: parseFloat(results[0].lat),
        lng: parseFloat(results[0].lon)
      };
    }
  } catch (error) {
    console.warn('Geocoding failed for address:', address, error);
  }

  return null;
}

async function processDataWithGeocoding(data) {
  const processedData = [];

  for (const item of data) {
    const processedItem = { ...item };

    // Check if coordinates are missing or invalid
    if (!processedItem.Latitude || !processedItem.Longitude || 
        processedItem.Latitude === 0 || processedItem.Longitude === 0) {

      // Try to geocode from address fields
      const coords = await geocodeAddress(
        processedItem.Street,
        processedItem.Zip,
        processedItem.City
      );

      if (coords) {
        processedItem.Latitude = coords.lat;
        processedItem.Longitude = coords.lng;
        console.log(`Geocoded ${processedItem.Name}: ${coords.lat}, ${coords.lng}`);
      } else {
        console.warn(`Could not geocode ${processedItem.Name}`);
      }
    }

    processedData.push(processedItem);
  }

  return processedData;
}

// Google Analytics 4 Event Tracking
function trackEvent(eventName, parameters = {}) {
  if (typeof gtag !== 'undefined') {
    gtag('event', eventName, parameters);
  }
}

function trackPageView(pageTitle) {
  if (typeof gtag !== 'undefined') {
    gtag('config', 'G-XXXXXXXXXX', {
      page_title: pageTitle
    });
  }
}

// Language system
async function loadTranslations() {
  try {
    const translationPath = translationPaths[currentLanguage] || translationPaths.nl;
    const response = await fetch(translationPath);
    translations = await response.json();
  } catch (error) {
    console.warn('Failed to load translations:', error);
    // Fallback to empty object
    translations = {};
  }
}

function t(key) {
  return translations[key] || key;
}

function updateLanguage(lang) {
  currentLanguage = lang;
  loadTranslations().then(() => {
    updatePageTexts();
  });
}

function updatePageTexts() {
  // Update texts based on translations
  document.querySelectorAll('[data-translate]').forEach(element => {
    const key = element.getAttribute('data-translate');
    element.textContent = t(key);
  });
}

// Map initialization
function initMap() {
  // Initialize map using config
  map = L.map('map', {
    center: mapConfig.defaultCenter,
    zoom: mapConfig.defaultZoom,
    zoomControl: false,
    scrollWheelZoom: true,
    doubleClickZoom: true,
    attributionControl: false
  });

  // Add zoom control to bottom right
  L.control.zoom({
    position: 'bottomright'
  }).addTo(map);

  // Use configured tile layer
  L.tileLayer(mapConfig.tileLayer.url, {
    attribution: mapConfig.tileLayer.attribution,
    ...mapConfig.tileLayer.options
  }).addTo(map);

  // Add municipality layer
  municipalityLayer = L.layerGroup().addTo(map);

  // Add markers layer
  map.addLayer(markers);
}

function loadMunicipalityBoundaries() {
  // Initialize municipality layer first
  if (!municipalityLayer) {
    municipalityLayer = L.layerGroup();
  }

  // Load municipalities using Netherlands GeoJSON data
  loadMunicipalitiesFromOverpass();
}

async function loadMunicipalitiesFromOverpass() {
  try {
    console.log('Loading municipality boundaries from local GeoJSON files...');

    // Load both Dutch and German municipalities
    await Promise.all([
      loadDutchMunicipalities(),
      loadGermanMunicipalities()
    ]);

  } catch (error) {
    console.error('Error loading municipalities from local GeoJSON:', error);
    console.log('Loading fallback municipalities...');
    loadProfessionalMunicipalities();
  }
}

async function loadDutchMunicipalities() {
  try {
    console.log('Loading Dutch municipalities...');
    const response = await fetch(dataPaths.dutchMunicipalities);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const geojsonData = await response.json();

    if (!geojsonData.features || geojsonData.features.length === 0) {
      throw new Error('No Dutch GeoJSON features found');
    }

    console.log(`Processing ${geojsonData.features.length} Dutch municipalities...`);
    let loadedCount = 0;

    geojsonData.features.forEach((feature) => {
      if (feature.properties && feature.properties.name) {
        const municipalityName = feature.properties.name;

        if (municipalityName && feature.geometry) {
          try {
            const geoJsonLayer = L.geoJSON(feature, {
              style: mapConfig.municipalityStyle.default,
              onEachFeature: function(feature, layer) {
                layer.on({
                  mouseover: function(e) {
                    const layer = e.target;
                    layer.setStyle(mapConfig.municipalityStyle.hover);
                    layer.bringToFront();
                  },
                  mouseout: function(e) {
                    const layer = e.target;
                    layer.setStyle(mapConfig.municipalityStyle.default);
                  },
                  click: function(e) {
                    // Zoom to municipality and filter
                    const bounds = layer.getBounds();
                    map.fitBounds(bounds);

                    // Apply municipality filter
                    filterByMunicipality(municipalityName);

                    // Track event
                    trackEvent('municipality_click', {
                      municipality: municipalityName,
                      country: 'Netherlands'
                    });
                  }
                });

                // Add popup with municipality info
                layer.bindPopup(`
                  <div class="municipality-popup">
                    <h3>${municipalityName}</h3>
                    <p>Klik voor meer details over gezond bouwen kansen in deze gemeente</p>
                  </div>
                `);
              }
            });

            municipalityLayer.addLayer(geoJsonLayer);
            loadedCount++;

            // Store municipality for filter dropdown
            municipalities.push({
              name: municipalityName,
              country: 'Netherlands',
              bounds: geoJsonLayer.getBounds()
            });

          } catch (layerError) {
            console.warn(`Error creating layer for Dutch municipality ${municipalityName}:`, layerError);
          }
        }
      }
    });

    console.log(`Successfully loaded ${loadedCount} Dutch municipalities`);

  } catch (error) {
    console.error('Error loading Dutch municipalities:', error);
    throw error;
  }
}

async function loadGermanMunicipalities() {
  try {
    console.log('Loading German municipalities...');
    const response = await fetch(dataPaths.germanMunicipalities);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const geojsonData = await response.json();

    if (!geojsonData.features || geojsonData.features.length === 0) {
      throw new Error('No German GeoJSON features found');
    }

    console.log(`Processing ${geojsonData.features.length} German municipalities...`);
    let loadedCount = 0;

    geojsonData.features.forEach((feature) => {
      // GADM format uses NAME_4 for municipality names
      const municipalityName = feature.properties?.NAME_4;
      const state = feature.properties?.NAME_1;

      if (municipalityName && feature.geometry) {
        try {
          const geoJsonLayer = L.geoJSON(feature, {
            style: {
              color: 'rgb(38, 123, 41)',
              weight: 4,
              opacity: 0.9,
              fillColor: 'rgb(38, 123, 41)',
              fillOpacity: 0.1,
              smoothFactor: 0.5,
              dashArray: '5, 8'
            },
            onEachFeature: function(feature, layer) {
              layer.on({
                mouseover: function(e) {
                  const layer = e.target;
                  layer.setStyle({
                    color: 'rgb(38, 123, 41)',
                    weight: 6,
                    opacity: 1,
                    fillColor: 'rgb(38, 123, 41)',
                    fillOpacity: 0.3,
                    dashArray: '5, 8'
                  });
                  layer.bringToFront();
                },
                mouseout: function(e) {
                  const layer = e.target;
                  layer.setStyle({
                    color: 'rgb(38, 123, 41)',
                    weight: 4,
                    opacity: 0.9,
                    fillColor: 'rgb(38, 123, 41)',
                    fillOpacity: 0.1,
                    dashArray: '5, 8'
                  });
                },
                click: function(e) {
                  // Zoom to municipality and filter
                  const bounds = layer.getBounds();
                  map.fitBounds(bounds);

                  // Apply municipality filter
                  filterByMunicipality(municipalityName);

                  // Track event
                  trackEvent('municipality_click', {
                    municipality: municipalityName,
                    country: 'Germany',
                    state: state
                  });
                }
              });

              // Add popup with municipality info
              layer.bindPopup(`
                <div class="municipality-popup">
                  <h3>${municipalityName}</h3>
                  <p>${state}, Deutschland</p>
                  <p>Klicken Sie für weitere Details zu gesunden Bauchancen in dieser Gemeinde</p>
                </div>
              `);
            }
          });

          municipalityLayer.addLayer(geoJsonLayer);
          loadedCount++;

          // Store municipality for filter dropdown
          municipalities.push({
            name: municipalityName,
            country: 'Germany',
            state: state,
            bounds: geoJsonLayer.getBounds()
          });

        } catch (layerError) {
          console.warn(`Error creating layer for German municipality ${municipalityName}:`, layerError);
        }
      }
    });

    console.log(`Successfully loaded ${loadedCount} German municipalities`);

  } catch (error) {
    console.error('Error loading German municipalities:', error);
    throw error;
  }
}

function loadProfessionalMunicipalities() {
  // Fallback professional municipalities for the Euregio region
  const eurregioMunicipalities = [
    {
      name: "Venlo",
      country: "Netherlands",
      bounds: [
        [51.35, 6.10],
        [51.40, 6.25]
      ]
    },
    {
      name: "Roermond", 
      country: "Netherlands",
      bounds: [
        [51.15, 5.95],
        [51.25, 6.05]
      ]
    },
    {
      name: "Maastricht",
      country: "Netherlands", 
      bounds: [
        [50.82, 5.63],
        [50.88, 5.72]
      ]
    },
    {
      name: "Aachen",
      country: "Germany",
      bounds: [
        [50.72, 6.02],
        [50.82, 6.12]
      ]
    },
    {
      name: "Mönchengladbach",
      country: "Germany",
      bounds: [
        [51.15, 6.35],
        [51.25, 6.45]
      ]
    },
    {
      name: "Krefeld",
      country: "Germany", 
      bounds: [
        [51.30, 6.50],
        [51.40, 6.60]
      ]
    }
  ];

  eurregioMunicipalities.forEach(municipality => {
    const polygon = L.polygon(municipality.bounds, {
      color: 'rgb(38, 123, 41)',
      weight: 4,
      opacity: 0.9,
      fillColor: 'rgb(38, 123, 41)',
      fillOpacity: 0.1,
      smoothFactor: 0.5,
      dashArray: '5, 8'
    });

    // Add hover effects
    polygon.on({
      mouseover: function(e) {
        const layer = e.target;
        layer.setStyle({
          color: 'rgb(38, 123, 41)',
          weight: 6,
          opacity: 1,
          fillColor: 'rgb(38, 123, 41)',
          fillOpacity: 0.3,
          dashArray: '5, 8'
        });
        layer.bringToFront();
      },
      mouseout: function(e) {
        const layer = e.target;
        layer.setStyle({
          color: 'rgb(38, 123, 41)',
          weight: 4,
          opacity: 0.9,
          fillColor: 'rgb(38, 123, 41)',
          fillOpacity: 0.1,
          dashArray: '5, 8'
        });
      }
    });

    // Add popup with municipality name and country
    polygon.bindPopup(`<strong>${municipality.name}</strong><br><small>${municipality.country}</small>`);

    municipalityLayer.addLayer(polygon);
  });

  console.log(`Loaded ${eurregioMunicipalities.length} professional municipalities`);
}

function filterByMunicipality(municipalityName) {
  // Update filter
  currentFilter.municipality = municipalityName;

  // Update UI
  const municipalitySelect = document.getElementById('municipality-filter');
  if (municipalitySelect) {
    municipalitySelect.value = municipalityName;
  }

  // Apply filters
  applyFilters();
}

// Create markers
function createMarkers(data) {
  markers.clearLayers();

  data.forEach(item => {
    if (item.Latitude && item.Longitude) {
      const icon = item.HBMType === 'Project' ? pIcon : bIcon;

      const marker = L.marker([item.Latitude, item.Longitude], {
        icon: icon
      });

      // Create popup content
      const popupContent = createPopupContent(item);
      marker.bindPopup(popupContent, {
        maxWidth: 300,
        className: 'custom-popup'
      });

      // Store item data for filtering
      marker.itemData = item;

      markers.addLayer(marker);
    }
  });
}

function createPopupContent(item) {
  // formatArray is now imported from utils.js

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
        ${item.OrganizationField ? `<p><strong>Vakgebied:</strong> ${formatArray(item.OrganizationField)}</p>` : ''}
        ${item.HBMTopic ? `<p><strong>HBM Onderwerp:</strong> ${formatArray(item.HBMTopic)}</p>` : ''}
        ${item.HBMCharacteristics ? `<p><strong>Kenmerken:</strong> ${formatArray(item.HBMCharacteristics)}</p>` : ''}
        ${item.HBMSector ? `<p><strong>Sector:</strong> ${item.HBMSector}</p>` : ''}
        ${item.Description ? `<p class="description">${item.Description}</p>` : ''}
      </div>

      <div class="popup-actions">
        <button onclick="showDetails('${item.Name}')" class="btn-details">Meer informatie</button>
        <button onclick="trackEvent('contact_click', {name: '${item.Name}'})" class="btn-contact">Contact</button>
      </div>
    </div>
  `;
}

// Filter functions
function applyFilters() {
  markers.clearLayers();

  const filteredData = window.data.filter(item => {
    // Type filter
    if (currentFilter.type && currentFilter.type !== 'all') {
      if (item.HBMType !== currentFilter.type) return false;
    }

    // Project type filter
    if (currentFilter.projectType && currentFilter.projectType !== 'all') {
      const projectTypes = Array.isArray(item.ProjectType) ? item.ProjectType : [item.ProjectType];
      if (!projectTypes.includes(currentFilter.projectType)) return false;
    }

    // Organization filter
    if (currentFilter.organization && currentFilter.organization !== 'all') {
      if (item.OrganizationType !== currentFilter.organization) return false;
    }

    // Topic filter
    if (currentFilter.topic && currentFilter.topic !== 'all') {
      const topics = Array.isArray(item.HBMTopic) ? item.HBMTopic : [item.HBMTopic];
      if (!topics.includes(currentFilter.topic)) return false;
    }

    // Sector filter
    if (currentFilter.sector && currentFilter.sector !== 'all') {
      if (item.HBMSector !== currentFilter.sector) return false;
    }

    // Municipality filter
    if (currentFilter.municipality && currentFilter.municipality !== 'all') {
      // This would need geocoding to work properly
      // For now, we'll skip this filter
    }

    // Location filter (if user location is set)
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
  updateResultCount(filteredData.length);
}

// calculateDistance is now imported from utils.js

function updateResultCount(count) {
  const resultElement = document.querySelector('.filter-results');
  if (resultElement) {
    resultElement.textContent = `${count} resultaten gevonden`;
  }
}

// Location functions
function getCurrentLocation() {
  if (!navigator.geolocation) {
    alert('Geolocatie wordt niet ondersteund door deze browser.');
    return;
  }

  const options = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 300000 // 5 minutes
  };

  navigator.geolocation.getCurrentPosition(
    position => {
      const { latitude, longitude } = position.coords;

      // Store user location
      currentFilter.userLocation = { lat: latitude, lng: longitude };

      // Center map on user location
      map.setView([latitude, longitude], 12);

      // Add user location marker
      if (userLocationCircle) {
        map.removeLayer(userLocationCircle);
      }

      userLocationCircle = L.circle([latitude, longitude], {
        color: '#3388ff',
        fillColor: '#3388ff',
        fillOpacity: 0.2,
        radius: currentFilter.radius || 5000
      }).addTo(map);

      // Update location button
      const locationBtn = document.querySelector('.location-btn');
      if (locationBtn) {
        locationBtn.textContent = 'Locatie gevonden';
        locationBtn.classList.add('active');
      }

      // Apply filters
      applyFilters();

      trackEvent('location_found', {
        latitude: latitude,
        longitude: longitude
      });
    },
    error => {
      console.error('Error getting location:', error);
      alert('Kon locatie niet bepalen. Controleer je browser instellingen.');
    },
    options
  );
}

function updateLocationRadius(radius) {
  currentFilter.radius = radius * 1000; // Convert to meters

  // Update circle if exists
  if (userLocationCircle && currentFilter.userLocation) {
    userLocationCircle.setRadius(currentFilter.radius);
  }

  // Apply filters
  applyFilters();
}

// UI Functions
function createHoverLabel() {
  hoverLabel = L.divIcon({
    className: 'hover-label',
    html: '<div></div>',
    iconSize: [0, 0]
  });
}

function initializeTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const target = button.getAttribute('data-tab');

      // Remove active class from all tabs
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));

      // Add active class to clicked tab
      button.classList.add('active');
      document.getElementById(target).classList.add('active');

      // Track tab switch
      trackEvent('tab_switch', { tab: target });
    });
  });
}

function populateFilters(data) {
  // Get unique values for each filter
  const projectTypes = [...new Set(data.flatMap(item => 
    Array.isArray(item.ProjectType) ? item.ProjectType : [item.ProjectType]
  ).filter(Boolean))];

  const organizations = [...new Set(data.map(item => item.OrganizationType).filter(Boolean))];
  const topics = [...new Set(data.flatMap(item => 
    Array.isArray(item.HBMTopic) ? item.HBMTopic : [item.HBMTopic]
  ).filter(Boolean))];
  const sectors = [...new Set(data.map(item => item.HBMSector).filter(Boolean))];

  // Populate dropdowns
  populateSelect('project-type-filter', projectTypes);
  populateSelect('organization-filter', organizations);
  populateSelect('topic-filter', topics);
  populateSelect('sector-filter', sectors);
  populateSelect('municipality-filter', municipalities.map(m => m.name));
}

function populateSelect(selectId, options) {
  const select = document.getElementById(selectId);
  if (!select) return;

  // Clear existing options except "all"
  const allOption = select.querySelector('option[value="all"]');
  select.innerHTML = '';
  if (allOption) {
    select.appendChild(allOption);
  }

  // Add new options
  options.forEach(option => {
    const optionElement = document.createElement('option');
    optionElement.value = option;
    optionElement.textContent = option;
    select.appendChild(optionElement);
  });
}

function initAutocomplete(data) {
  const searchInput = document.getElementById('search-input');
  if (!searchInput) return;

  const suggestions = data.map(item => item.Name).filter(Boolean);

  // Simple autocomplete implementation
  searchInput.addEventListener('input', function() {
    const value = this.value.toLowerCase();
    // Implementation would go here
  });
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
  // Filter event listeners
  const filterSelects = document.querySelectorAll('.filter-select');
  filterSelects.forEach(select => {
    select.addEventListener('change', function() {
      const filterType = this.id.replace('-filter', '').replace('-', '');
      currentFilter[filterType] = this.value === 'all' ? null : this.value;
      applyFilters();

      trackEvent('filter_change', {
        filter_type: filterType,
        filter_value: this.value
      });
    });
  });

  // Location button
  const locationBtn = document.querySelector('.location-btn');
  if (locationBtn) {
    locationBtn.addEventListener('click', getCurrentLocation);
  }

  // Radius slider
  const radiusSlider = document.getElementById('radius-slider');
  if (radiusSlider) {
    radiusSlider.addEventListener('input', function() {
      updateLocationRadius(parseInt(this.value));
      document.getElementById('radius-value').textContent = this.value + ' km';
    });
  }

  // Search functionality
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      const searchTerm = this.value.toLowerCase();
      if (searchTerm) {
        const filteredData = window.data.filter(item => 
          item.Name?.toLowerCase().includes(searchTerm) ||
          item.Description?.toLowerCase().includes(searchTerm)
        );
        createMarkers(filteredData);
        updateResultCount(filteredData.length);
      } else {
        applyFilters();
      }
    });
  }
});

// Global functions for popup actions
function showDetails(itemName) {
  const item = window.data.find(d => d.Name === itemName);
  if (item) {
    // Create detail modal or navigate to detail page
    console.log('Show details for:', item);
    trackEvent('details_view', { name: itemName });
  }
}

// Add missing functions
function updateFilterState() {
  applyFilters();
}

function toggleAdvancedFilters() {
  const advancedFilters = document.getElementById('advancedFilters');
  if (advancedFilters) {
    advancedFilters.classList.toggle('open');
  }
}

// Export for global access
window.getCurrentLocation = getCurrentLocation;
window.showDetails = showDetails;
window.trackEvent = trackEvent;
window.updateFilterState = updateFilterState;
window.toggleAdvancedFilters = toggleAdvancedFilters;