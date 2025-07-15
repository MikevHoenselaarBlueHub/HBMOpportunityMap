// Global variables
let map;
let markers;
let municipalityLayer;
let userLocationCircle;
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

      // Initialize marker cluster group
      markers = L.markerClusterGroup({
        disableClusteringAtZoom: 15,
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true
      });

      // Initialize icons
      pIcon = L.icon({
        iconUrl: 'icons/marker-project.svg',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
      });
      bIcon = L.icon({
        iconUrl: 'icons/marker-company.svg',
        iconSize: [32, 32], 
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
      });

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

      // Data laden
      fetch('data/opportunities.json')
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

          // Create markers first
          createMarkers(window.data);

          // Populate filter dropdowns
          populateFilters(window.data);

          // Apply initial filters
          applyFilters();

          // Load filters from URL
          loadFromURL();

          // Initialize auto complete
          initAutocomplete(window.data);

          // Initialize filter functionality
          initializeFilters();

          // Initialize list view
          initializeListView();

          // Show legend
          showLegend();

          console.log('Map initialization complete');
        })
        .catch(error => {
          console.error('Error loading data:', error);
          // Initialize empty data array
          window.data = [];
          // Initialize map even if data fails to load
          initMap();
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
    const translationPath = `translations/${currentLanguage}.json`;
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
  // Initialize map
  map = L.map('map', {
    center: [51.2, 6.0], // Euregio center
    zoom: 8,
    zoomControl: false,
    scrollWheelZoom: true,
    doubleClickZoom: true,
    attributionControl: false
  });

  // Add zoom control to bottom right
  L.control.zoom({
    position: 'bottomright'
  }).addTo(map);

  // Add simplified tile layer
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap contributors © CARTO',
    maxZoom: 18
  }).addTo(map);

  // Initialize municipality layer
  municipalityLayer = L.layerGroup();

  // Add layer control for municipalities
  const layerControl = L.control.layers({}, {
    'Gemeentegrenzen': municipalityLayer
  }, {
    position: 'topright'
  }).addTo(map);

  // Load municipality boundaries
  loadMunicipalityBoundaries();

  // Add markers layer to map
  map.addLayer(markers);
}

function loadMunicipalityBoundaries() {
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
    const response = await fetch('data/geojson/nl-gemeenten.geojson');

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
    const response = await fetch('data/geojson/de-gemeenten.geojson');

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
        <button onclick="showDetails('${encodeURIComponent(item.Name || '')}')" class="card-contact-btn">Meer info</button>
        <button onclick="openContactForm('${encodeURIComponent(item.Name || '')}')" class="card-contact-btn">Contact</button>
      </div>
    </div>
  `;
}

// Filter functions
function applyFilters() {
  if (!window.data || !Array.isArray(window.data)) {
    console.warn('No data available for filtering');
    return;
  }

  markers.clearLayers();

  // Get filter values from form
  const checkedTypes = Array.from(document.querySelectorAll('input[name="HBMType"]:checked')).map(cb => cb.value);

  const filteredData = window.data.filter(item => {
    // Type filter (Project/Bedrijf checkboxes)
    if (checkedTypes.length > 0 && !checkedTypes.includes(item.HBMType)) {
      return false;
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
  updateListView(filteredData);
  updateResultCount(filteredData.length);
}

// Calculate distance between two coordinates using Haversine formula
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Format array for display
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
      filterState.userLocation = { lat: latitude, lng: longitude };

      // Get current distance value
      const distanceRange = document.getElementById('distanceRange');
      const radius = distanceRange ? parseInt(distanceRange.value) : 25;
      currentFilter.radius = radius * 1000;
      filterState.radius = radius;

      // Center map on user location
      map.setView([latitude, longitude], 12);

      // Add user location marker and circle
      if (userLocationCircle) {
        map.removeLayer(userLocationCircle);
      }

      // Add user location marker
      const userMarker = L.marker([latitude, longitude], {
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
      if (distanceFilter) {
        distanceFilter.style.display = 'block';
      }

      const distanceRange = document.getElementById('distanceRange');
      const distanceValue = document.getElementById('distanceValue');
      if (distanceRange && distanceValue) {
        distanceRange.value = radius;
        distanceValue.textContent = radius + ' km';
      }

      const locationBtn = document.getElementById('useMyLocation');
      if (locationBtn) {
        locationBtn.innerHTML = '<span>📍 Locatie actief</span>';
        locationBtn.classList.add('active');
      }

      // Show clear location button
      const clearLocationBtn = document.getElementById('clearLocation');
      if (clearLocationBtn) {
        clearLocationBtn.style.display = 'block';
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
  filterState.radius = radius;

  // Update circle if exists
  if (userLocationCircle && currentFilter.userLocation) {
    userLocationCircle.setRadius(currentFilter.radius);
  }

  // Update URL
  updateURL();

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

function showLegend() {
  const legend = document.getElementById('mapLegend');
  if (legend) {
    legend.style.display = 'block';
  }
}

function initializeTabs() {
  const tabButtons = document.querySelectorAll('.list-tab');
  const tabContents = document.querySelectorAll('.tab-pane');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const target = button.getAttribute('data-tab');

      // Remove active class from all tabs
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));

      // Add active class to clicked tab
      button.classList.add('active');
      const targetPane = document.getElementById(target + 'Tab');
      if (targetPane) {
        targetPane.classList.add('active');
      }

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
  const organizationFields = [...new Set(data.flatMap(item => 
    Array.isArray(item.OrganizationField) ? item.OrganizationField : [item.OrganizationField]
  ).filter(Boolean))];
  const topics = [...new Set(data.flatMap(item => 
    Array.isArray(item.HBMTopic) ? item.HBMTopic : [item.HBMTopic]
  ).filter(Boolean))];
  const characteristics = [...new Set(data.flatMap(item => 
    Array.isArray(item.HBMCharacteristics) ? item.HBMCharacteristics : [item.HBMCharacteristics]
  ).filter(Boolean))];
  const sectors = [...new Set(data.map(item => item.HBMSector).filter(Boolean))];

  // Populate filter sections
  populateFilterSection('ProjectType', projectTypes);
  populateFilterSection('OrganizationType', organizations);
  populateFilterSection('OrganizationField', organizationFields);
  populateFilterSection('HBMTopic', topics);
  populateFilterSection('HBMCharacteristics', characteristics);
  populateFilterSection('HBMSector', sectors);

  // Populate municipality select
  const municipalitySelect = document.getElementById('municipalitySelect');
  if (municipalitySelect) {
    municipalities.forEach(municipality => {
      const option = document.createElement('option');
      option.value = municipality.name;
      option.textContent = `${municipality.name} (${municipality.country})`;
      municipalitySelect.appendChild(option);
    });
  }
}

function populateFilterSection(sectionId, options) {
  const section = document.getElementById(sectionId);
  if (!section) return;

  section.innerHTML = ''; // Clear existing content

  options.forEach(option => {
    const label = document.createElement('label');
    label.innerHTML = `
      <input type="checkbox" name="${sectionId}" value="${option}" onchange="updateFilterState()">
      <span>${option}</span>
    `;
    section.appendChild(label);
  });
}

function initAutocomplete(data) {
  const searchInput = document.getElementById('mapSearch');
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
  // Initialize UI components if not on map page
  if (!isMapPage) {
    initializeFilters();
    initializeListView();
    return;
  }

  // Initialize filter functionality first
  initializeFilters();

  // Initialize options dropdown
  const optionsBtn = document.getElementById('optionsBtn');
  const filterDropdown = optionsBtn?.parentElement;
  if (optionsBtn && filterDropdown) {
    optionsBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      filterDropdown.classList.toggle('open');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
      if (!filterDropdown.contains(e.target)) {
        filterDropdown.classList.remove('open');
      }
    });
  }

  // Initialize other dropdown buttons
  const exportBtn = document.getElementById('exportBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', function() {
      alert('Export functionaliteit komt binnenkort beschikbaar.');
    });
  }

  const saveCurrentFiltersBtn = document.getElementById('saveCurrentFiltersBtn');
  if (saveCurrentFiltersBtn) {
    saveCurrentFiltersBtn.addEventListener('click', saveCurrentFilters);
  }

  const loadSavedFiltersBtn = document.getElementById('loadSavedFiltersBtn');
  if (loadSavedFiltersBtn) {
    loadSavedFiltersBtn.addEventListener('click', function() {
      const savedFilters = JSON.parse(localStorage.getItem('hbm_saved_filters') || '{}');
      const filterNames = Object.keys(savedFilters);

      if (filterNames.length === 0) {
        alert('Geen opgeslagen filters gevonden.');
        return;
      }

      const selectedFilter = prompt('Kies een opgeslagen filter:\n' + filterNames.map((name, i => `${i + 1}. ${name}`).join('\n'));
      if (selectedFilter && filterNames.includes(selectedFilter)) {
        loadSavedFilter(selectedFilter);
      }
    });
  }

  // Location button
  const locationBtn = document.getElementById('useMyLocation');
  if (locationBtn) {
    locationBtn.addEventListener('click', getCurrentLocation);
  }

    // Clear location button
    const clearLocationBtn = document.getElementById('clearLocation');
    if (clearLocationBtn) {
      clearLocationBtn.addEventListener('click', function() {
        // Remove user location
        currentFilter.userLocation = null;
        filterState.userLocation = null;
  
        // Remove circle
        if (userLocationCircle) {
          map.removeLayer(userLocationCircle);
        }
  
        // Hide distance filter
        const distanceFilter = document.getElementById('distanceFilter');
        if (distanceFilter) {
          distanceFilter.style.display = 'none';
        }
  
        // Update location button
        const locationBtn = document.getElementById('useMyLocation');
        if (locationBtn) {
          locationBtn.innerHTML = '<span>📍 Gebruik mijn locatie</span>';
          locationBtn.classList.remove('active');
        }

          // Hide clear location button
          const clearLocationBtn = document.getElementById('clearLocation');
          if (clearLocationBtn) {
            clearLocationBtn.style.display = 'none';
          }
  
        // Apply filters
        applyFilters();
      });
    }

  // Distance range slider
  const distanceRange = document.getElementById('distanceRange');
  const distanceValue = document.getElementById('distanceValue');
  if (distanceRange && distanceValue) {
    distanceRange.addEventListener('input', function() {
      const value = parseInt(this.value);
      distanceValue.textContent = value + ' km';
      updateLocationRadius(value);
    });
  }

  // Search functionality
  const searchInput = document.getElementById('mapSearch');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      const searchTerm = this.value.toLowerCase();
      if (searchTerm && window.data) {
        const filteredData = window.data.filter(item => 
          item.Name?.toLowerCase().includes(searchTerm) ||
          item.Description?.toLowerCase().includes(searchTerm)
        );
        createMarkers(filteredData);
        updateListView(filteredData);
        updateResultCount(filteredData.length);
      } else {
        applyFilters();
      }
    });
  }

  // Initialize hamburger menu
  const hamburger = document.getElementById('hamburger');
  const menuOverlay = document.getElementById('menuOverlay');
  const closeMenu = document.getElementById('closeMenu');

  if (hamburger && menuOverlay) {
    hamburger.addEventListener('click', function() {
      menuOverlay.classList.add('open');
    });
  }

  if (closeMenu && menuOverlay) {
    closeMenu.addEventListener('click', function() {
      menuOverlay.classList.remove('open');
    });
  }
});

// Filter UI initialization
function initializeFilters() {
  // Initialize filter overlay toggle
  const filterBtn = document.getElementById('filterBtn');
  const filterOverlay = document.getElementById('filterOverlay');
  const closeFiltersBtn = document.getElementById('closeFilters');

  if (filterBtn && filterOverlay) {
    filterBtn.addEventListener('click', function() {
      filterOverlay.classList.add('open');
    });
  }

  if (closeFiltersBtn && filterOverlay) {
    closeFiltersBtn.addEventListener('click', function() {
      filterOverlay.classList.remove('open');
    });
  }

  // Initialize filter form elements
  const filterForm = document.getElementById('filtersForm');
  if (filterForm) {
    filterForm.addEventListener('change', function(e) {
      if (e.target.type === 'checkbox' || e.target.type === 'radio') {
        updateFilterState();
      }
    });
  }

  // Initialize select all/none buttons
  const selectAllBtn = document.getElementById('selectAll');
  const selectNoneBtn = document.getElementById('selectNone');

  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', function() {
      const checkboxes = filterForm.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach(checkbox => {
        checkbox.checked = true;
      });
      updateFilterState();
    });
  }

  if (selectNoneBtn) {
    selectNoneBtn.addEventListener('click', function() {
      const checkboxes = filterForm.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach(checkbox => {
        checkbox.checked = false;
      });
      updateFilterState();
    });
  }

  // Initialize advanced filters toggle
  const advancedFiltersHeader = document.querySelector('.advanced-filters-header');
  if (advancedFiltersHeader) {
    advancedFiltersHeader.addEventListener('click', function(e) {
      e.preventDefault();
      toggleAdvancedFilters();
    });
  }

  // Initialize apply filters button
  const applyFiltersBtn = document.getElementById('applyFilters');
  if (applyFiltersBtn) {
    applyFiltersBtn.addEventListener('click', function() {
      applyFilters();
      filterOverlay.classList.remove('open');
    });
  }

  // Initialize saved filters functionality
  const saveCurrentFiltersBtn = document.getElementById('saveCurrentFilters');
  if (saveCurrentFiltersBtn) {
    saveCurrentFiltersBtn.addEventListener('click', saveCurrentFilters);
  }

  const savedFiltersSelect = document.getElementById('savedFiltersSelect');
  if (savedFiltersSelect) {
    savedFiltersSelect.addEventListener('change', function() {
      if (this.value) {
        loadSavedFilter(this.value);
      }
    });
  }

  const deleteSavedFilterBtn = document.getElementById('deleteSavedFilter');
  if (deleteSavedFilterBtn) {
    deleteSavedFilterBtn.addEventListener('click', deleteSavedFilter);
  }

  // Initialize share functionality
  const shareBtn = document.getElementById('shareBtn');
  if (shareBtn) {
    shareBtn.addEventListener('click', shareCurrentFilters);
  }

  // Load saved filters dropdown
  updateSavedFiltersDropdown();
}

// List view functionality
function initializeListView() {
  const viewToggle = document.getElementById('viewToggle');
  const listContainer = document.querySelector('.list-container');

  if (viewToggle && listContainer) {
    viewToggle.addEventListener('click', function() {
      listContainer.classList.toggle('show');
      const isShowing = listContainer.classList.contains('show');
      viewToggle.querySelector('#viewToggleText').textContent = isShowing ? 'Kaart' : 'Lijst';
    });
  }

  // Initialize tab functionality
  const tabButtons = document.querySelectorAll('.list-tab');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      const targetTab = this.getAttribute('data-tab');

      // Remove active from all tabs
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabPanes.forEach(pane => pane.classList.remove('active'));

      // Add active to clicked tab
      this.classList.add('active');
      const targetPane = document.getElementById(targetTab + 'Tab');
      if (targetPane) {
        targetPane.classList.add('active');
      }
    });
  });
}

// Update list with filtered data
function updateListView(data) {
  const buildingsList = document.getElementById('opportunitiesList');
  const companiesList = document.getElementById('companiesList');
  const buildingsCount = document.getElementById('buildingsCount');
  const companiesCount = document.getElementById('companiesCount');
  const resultsCount = document.getElementById('resultsCount');

  if (!buildingsList || !companiesList) return;

  // Separate data by type
  const projects = data.filter(item => item.HBMType === 'Project');
  const companies = data.filter(item => item.HBMType === 'Bedrijf');

  // Update counts
  if (buildingsCount) buildingsCount.textContent = `(${projects.length})`;
  if (companiesCount) companiesCount.textContent = `(${companies.length})`;
  if (resultsCount) resultsCount.textContent = `${data.length} resultaten`;

  // Clear existing content
  buildingsList.innerHTML = '';
  companiesList.innerHTML = '';

  // Add projects to buildings list
  if (projects.length === 0) {
    buildingsList.innerHTML = '<div class="no-results-opportunity"><h2>Geen projecten gevonden</h2><p>Probeer andere filters om meer resultaten te vinden.</p></div>';
  } else {
    projects.forEach(item => {
      buildingsList.appendChild(createListItem(item));
    });
  }

  // Add companies to companies list
  if (companies.length === 0) {
    companiesList.innerHTML = '<div class="no-results-opportunity"><h2>Geen bedrijven gevonden</h2><p>Probeer andere filters om meer resultaten te vinden.</p></div>';
  } else {
    companies.forEach(item => {
      companiesList.appendChild(createListItem(item));
    });
  }
}

// Create list item element
function createListItem(item) {
  const div = document.createElement('div');
  div.className = 'opportunity-card';
  div.innerHTML = `
    <div class="card-header">
      <h3 class="card-title">${item.Name || 'Onbekend'}</h3>
      <span class="card-type-badge ${item.HBMType?.toLowerCase() || 'unknown'}">${item.HBMType || 'Onbekend'}</span>
    </div>
    ${item.Logo ? `<img src="${item.Logo}" alt="Logo" class="card-logo" onerror="this.style.display='none'">` : ''}
    ${item.ProjectImage ? `<img src="${item.ProjectImage}" alt="Project" class="card-image" onerror="this.style.display='none'">` : ''}
    <div class="card-details">
      ${item.OrganizationType ? `<div class="card-detail-row"><span class="card-detail-label">Type:</span><span class="card-detail-value">${item.OrganizationType}</span></div>` : ''}
      ${item.HBMSector ? `<div class="card-detail-row"><span class="card-detail-label">Sector:</span><span class="card-detail-value">${item.HBMSector}</span></div>` : ''}
    </div>
    ${item.Description ? `<p class="card-description">${item.Description}</p>` : ''}
    <div class="card-actions">
      <button class="card-contact-btn" onclick="showDetails('${item.Name}')">Meer info</button>
    </div>
  `;

  div.addEventListener('click', function() {
    // Highlight corresponding marker on map
    if (item.Latitude && item.Longitude) {
      map.setView([item.Latitude, item.Longitude], 15);
    }
  });

  return div;
}

// Global functions for popup actions
function showDetails(itemName) {
  const decodedName = decodeURIComponent(itemName);
  const item = window.data.find(d => d.Name === decodedName);
  if (item) {
    openDetailPanel(item);
    trackEvent('details_view', { name: decodedName });
  }
}

function openContactForm(itemName) {
  const decodedName = decodeURIComponent(itemName);
  const item = window.data.find(d => d.Name === decodedName);
  if (item) {
    alert(`Contact informatie voor ${decodedName} wordt binnenkort beschikbaar gesteld.`);
    trackEvent('contact_click', { name: decodedName });
  }
}

function openDetailPanel(item) {
  const detailPanel = document.getElementById('detailPanel');
  if (!detailPanel) return;

  // Find current item index in filtered data
  const currentData = getCurrentFilteredData();
  const currentIndex = currentData.findIndex(d => d.Name === item.Name);
  const totalItems = currentData.length;

  detailPanel.innerHTML = `
    <a href="#" id="closeDetail" class="close-btn">
      <img src="icons/close.svg" alt="Sluiten" class="close-icon" />
    </a>
    <div class="detail-navigation">
      <button id="prevDetail" class="nav-btn ${currentIndex === 0 ? 'disabled' : ''}" ${currentIndex === 0 ? 'disabled' : ''}>
        <img src="icons/close.svg" alt="Vorige" class="nav-icon nav-icon-left" />
      </button>
      <span class="nav-counter">${currentIndex + 1} / ${totalItems}</span>
      <button id="nextDetail" class="nav-btn ${currentIndex === totalItems - 1 ? 'disabled' : ''}" ${currentIndex === totalItems - 1 ? 'disabled' : ''}>
        <img src="icons/close.svg" alt="Volgende" class="nav-icon nav-icon-right" />
      </button>
    </div>
    <div class="detail-content">
      <div class="detail-header">
        <h2>${item.Name || 'Onbekend'}</h2>
        <span class="detail-type-badge ${item.HBMType?.toLowerCase() || 'unknown'}">${item.HBMType || 'Onbekend'}</span>
      </div>

      <div class="detail-images">
        ${item.Logo ? `<img src="${item.Logo}" alt="Logo" class="detail-logo" onerror="this.style.display='none'">` : ''}
        ${item.ProjectImage ? `<img src="${item.ProjectImage}" alt="Project" class="detail-image" onerror="this.style.display='none'">` : ''}
      </div>

      <div class="detail-info">
        ${item.Description ? `<div class="detail-description"><h4>Beschrijving</h4><p>${item.Description}</p></div>` : ''}

        <div class="detail-specs">
          ${item.ProjectType ? `<div class="detail-row"><strong>Project Type:</strong> ${formatArray(item.ProjectType)}</div>` : ''}
          ${item.OrganizationType ? `<div class="detail-row"><strong>Organisatie:</strong> ${item.OrganizationType}</div>` : ''}
          ${item.OrganizationField ? `<div class="detail-row"><strong>Vakgebied:</strong> ${formatArray(item.OrganizationField)}</div>` : ''}
          ${item.HBMTopic ? `<div class="detail-row"><strong>HBM Onderwerp:</strong> ${formatArray(item.HBMTopic)}</div>` : ''}
          ${item.HBMCharacteristics ? `<div class="detail-row"><strong>Kenmerken:</strong> ${formatArray(item.HBMCharacteristics)}</div>` : ''}
          ${item.HBMSector ? `<div class="detail-row"><strong>Sector:</strong> ${item.HBMSector}</div>` : ''}
          ${item.Street || item.City ? `<div class="detail-row"><strong>Adres:</strong> ${[item.Street, item.Zip, item.City].filter(Boolean).join(', ')}</div>` : ''}
        </div>
      </div>

      <div class="detail-actions">
        <button onclick="openContactForm('${encodeURIComponent(item.Name || '')}')" class="card-contact-btn">Contact opnemen</button>
      </div>
    </div>
  `;

  // Show the panel
  detailPanel.classList.add('open');

  // Add close functionality
  const closeBtn = detailPanel.querySelector('#closeDetail');
  if (closeBtn) {
    closeBtn.addEventListener('click', function(e) {
      e.preventDefault();
      detailPanel.classList.remove('open');
    });
  }

  // Add navigation functionality
  const prevBtn = detailPanel.querySelector('#prevDetail');
  const nextBtn = detailPanel.querySelector('#nextDetail');

  if (prevBtn && currentIndex > 0) {
    prevBtn.addEventListener('click', function() {
      const prevItem = currentData[currentIndex - 1];
      if (prevItem) {
        openDetailPanel(prevItem);
        // Center map on new item
        if (prevItem.Latitude && prevItem.Longitude) {
          map.setView([prevItem.Latitude, prevItem.Longitude], map.getZoom());
        }
      }
    });
  }

  if (nextBtn && currentIndex < totalItems - 1) {
    nextBtn.addEventListener('click', function() {
      const nextItem = currentData[currentIndex + 1];
      if (nextItem) {
        openDetailPanel(nextItem);
        // Center map on new item
        if (nextItem.Latitude && nextItem.Longitude) {
          map.setView([nextItem.Latitude, nextItem.Longitude], map.getZoom());
        }
      }
    });
  }
}

// Helper function to get current filtered data
function getCurrentFilteredData() {
  if (!window.data || !Array.isArray(window.data)) {
    return [];
  }

  // Get filter values from form
  const checkedTypes = Array.from(document.querySelectorAll('input[name="HBMType"]:checked')).map(cb => cb.value);

  return window.data.filter(item => {
    // Type filter (Project/Bedrijf checkboxes)
    if (checkedTypes.length > 0 && !checkedTypes.includes(item.HBMType)) {
      return false;
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
}

// Add missing functions
function updateFilterState() {
  // Update filter state object
  const checkedTypes = Array.from(document.querySelectorAll('input[name="HBMType"]:checked')).map(cb => cb.value);
  filterState.checkedTypes = checkedTypes;

  // Get all other checked filters
  const filterSections = ['ProjectType', 'OrganizationType', 'OrganizationField', 'HBMTopic', 'HBMCharacteristics', 'HBMSector'];
  filterState.checkedFilters = {};

  filterSections.forEach(section => {
    const checked = Array.from(document.querySelectorAll(`input[name="${section}"]:checked`)).map(cb => cb.value);
    if (checked.length > 0) {
      filterState.checkedFilters[section] = checked;
    }
  });

  // Update URL
  updateURL();

  applyFilters();
}

function toggleAdvancedFilters() {
  const advancedFilters = document.getElementById('advancedFilters');
  if (advancedFilters) {
    advancedFilters.classList.toggle('open');
  }
}

// URL state management
function updateURL() {
  const params = new URLSearchParams();

  // Add filter types
  if (filterState.checkedTypes.length > 0 && filterState.checkedTypes.length < 2) {
    params.set('types', filterState.checkedTypes.join(','));
  }

  // Add other filters
  Object.keys(filterState.checkedFilters).forEach(section => {
    if (filterState.checkedFilters[section].length > 0) {
      params.set(section.toLowerCase(), filterState.checkedFilters[section].join(','));
    }
  });

  // Add location if set
  if (filterState.userLocation) {
    params.set('lat', filterState.userLocation.lat.toFixed(6));
    params.set('lng', filterState.userLocation.lng.toFixed(6));
    params.set('radius', filterState.radius);
  }

  const url = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
  window.history.replaceState({}, '', url);
}

function loadFromURL() {
  const params = new URLSearchParams(window.location.search);

  // Load filter types
  if (params.has('types')) {
    const types = params.get('types').split(',');
    filterState.checkedTypes = types;

    // Update checkboxes
    document.querySelectorAll('input[name="HBMType"]').forEach(cb => {
      cb.checked = types.includes(cb.value);
    });
  }

  // Load other filters
  const filterSections = ['ProjectType', 'OrganizationType', 'OrganizationField', 'HBMTopic', 'HBMCharacteristics', 'HBMSector'];
  filterSections.forEach(section => {
    const paramKey = section.toLowerCase();
    if (params.has(paramKey)) {
      const values = params.get(paramKey).split(',');
      filterState.checkedFilters[section] = values;

      // Update checkboxes when they exist
      setTimeout(() => {
        document.querySelectorAll(`input[name="${section}"]`).forEach(cb => {
          cb.checked = values.includes(cb.value);
        });
      }, 100);
    }
  });

  // Load location
  if (params.has('lat') && params.has('lng')) {
    const lat = parseFloat(params.get('lat'));
    const lng = parseFloat(params.get('lng'));
    const radius = params.has('radius') ? parseInt(params.get('radius')) : 25;

    filterState.userLocation = { lat, lng };
    filterState.radius = radius;
    currentFilter.userLocation = { lat, lng };
    currentFilter.radius = radius * 1000;

    // Show location on map
    if (map) {
      map.setView([lat, lng], 12);

      // Add user location marker and circle
      if (userLocationCircle) {
        map.removeLayer(userLocationCircle);
      }

      // Add user location marker
      const userMarker = L.marker([lat, lng], {
        icon: L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34]
        })
      }).addTo(map).bindPopup('Uw locatie');

      // Add radius circle
      userLocationCircle = L.circle([lat, lng], {
        color: '#3388ff',
        fillColor: '#3388ff',
        fillOpacity: 0.2,
        radius: radius * 1000
      }).addTo(map);

      // Update UI
      const distanceFilter = document.getElementById('distanceFilter');
      if (distanceFilter) {
        distanceFilter.style.display = 'block';
      }

      const distanceRange = document.getElementById('distanceRange');
      const distanceValue = document.getElementById('distanceValue');
      if (distanceRange && distanceValue) {
        distanceRange.value = radius;
        distanceValue.textContent = radius + ' km';
      }

      const locationBtn = document.getElementById('useMyLocation');
      if (locationBtn) {
        locationBtn.innerHTML = '<span>📍 Locatie actief</span>';
        locationBtn.classList.add('active');
      }

      // Show clear location button
      const clearLocationBtn = document.getElementById('clearLocation');
      if (clearLocationBtn) {
        clearLocationBtn.style.display = 'block';
      }
    }
  }
}

// Filter saving/loading functions
function saveCurrentFilters() {
  const filterName = prompt('Geef een naam voor deze filter configuratie:');
  if (!filterName) return;

  const savedFilters = JSON.parse(localStorage.getItem('hbm_saved_filters') || '{}');
  savedFilters[filterName] = {
    ...filterState,
    timestamp: new Date().toISOString()
  };

  localStorage.setItem('hbm_saved_filters', JSON.stringify(savedFilters));
  updateSavedFiltersDropdown();
  alert(`Filter "${filterName}" opgeslagen!`);
}

function loadSavedFilter(filterName) {
  const savedFilters = JSON.parse(localStorage.getItem('hbm_saved_filters') || '{}');
  if (!savedFilters[filterName]) return;

  const savedFilter = savedFilters[filterName];

  // Load filter state
  filterState = { ...savedFilter };
  delete filterState.timestamp;

  // Update UI
  document.querySelectorAll('input[name="HBMType"]').forEach(cb => {
    cb.checked = filterState.checkedTypes.includes(cb.value);
  });

  // Clear all other checkboxes first
  const filterSections = ['ProjectType', 'OrganizationType', 'OrganizationField', 'HBMTopic', 'HBMCharacteristics', 'HBMSector'];
  filterSections.forEach(section => {
    document.querySelectorAll(`input[name="${section}"]`).forEach(cb => {
      cb.checked = false;
    });
  });

  // Set saved filter checkboxes
  Object.keys(filterState.checkedFilters).forEach(section => {
    filterState.checkedFilters[section].forEach(value => {
      const checkbox = document.querySelector(`input[name="${section}"][value="${value}"]`);
      if (checkbox) {
        checkbox.checked = true;
      }
    });
  });

  // Load location if saved
  if (filterState.userLocation) {
    currentFilter.userLocation = filterState.userLocation;
    currentFilter.radius = filterState.radius * 1000;

    if (map) {
      map.setView([filterState.userLocation.lat, filterState.userLocation.lng], 12);

      // Add user location marker and circle
      if (userLocationCircle) {
        map.removeLayer(userLocationCircle);
      }

      // Add user location marker
      const userMarker = L.marker([filterState.userLocation.lat, filterState.userLocation.lng], {
        icon: L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34]
        })
      }).addTo(map).bindPopup('Uw locatie');

      // Add radius circle
      userLocationCircle = L.circle([filterState.userLocation.lat, filterState.userLocation.lng], {
        color: '#3388ff',
        fillColor: '#3388ff',
        fillOpacity: 0.2,
        radius: filterState.radius * 1000
      }).addTo(map);

      // Update UI
      const distanceFilter = document.getElementById('distanceFilter');
      if (distanceFilter) {
        distanceFilter.style.display = 'block';
      }

      const distanceRange = document.getElementById('distanceRange');
      const distanceValue = document.getElementById('distanceValue');
      if (distanceRange && distanceValue) {
        distanceRange.value = filterState.radius;
        distanceValue.textContent = filterState.radius + ' km';
      }

      const locationBtn = document.getElementById('useMyLocation');
      if (locationBtn) {
        locationBtn.innerHTML = '<span>📍 Locatie actief</span>';
        locationBtn.classList.add('active');
      }

      // Show clear location button
      const clearLocationBtn = document.getElementById('clearLocation');
      if (clearLocationBtn) {
        clearLocationBtn.style.display = 'block';
      }
    }
  }

  updateFilterState();
  alert(`Filter "${filterName}" geladen!`);
}

function deleteSavedFilter() {
  const select = document.getElementById('savedFiltersSelect');
  const filterName = select.value;
  if (!filterName) return;

  if (!confirm(`Weet je zeker dat je filter "${filterName}" wilt verwijderen?`)) return;

  const savedFilters = JSON.parse(localStorage.getItem('hbm_saved_filters') || '{}');
  delete savedFilters[filterName];
  localStorage.setItem('hbm_saved_filters', JSON.stringify(savedFilters));

  updateSavedFiltersDropdown();
  alert(`Filter "${filterName}" verwijderd!`);
}

function updateSavedFiltersDropdown() {
  const select = document.getElementById('savedFiltersSelect');
  if (!select) return;

  const savedFilters = JSON.parse(localStorage.getItem('hbm_saved_filters') || '{}');

  select.innerHTML = '<option value="">Selecteer opgeslagen filter...</option>';

  Object.keys(savedFilters).forEach(filterName => {
    const option = document.createElement('option');
    option.value = filterName;
    option.textContent = filterName;
    select.appendChild(option);
  });

  // Update saved filters text
  updateSavedFiltersText(Object.keys(savedFilters).length);
}

function updateSavedFiltersText(count) {
  const savedFiltersText = document.getElementById('savedFiltersText');
  if (savedFiltersText) {
    savedFiltersText.textContent = `Opgeslagen filters${count > 0 ? ` (${count})` : ''}`;
  }
}

// Share functionality
function shareCurrentFilters() {
  const url = window.location.href;

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(url).then(() => {
      alert('URL gekopieerd naar klembord!');
    }).catch(() => {
      fallbackCopyToClipboard(url);
    });
  } else {
    fallbackCopyToClipboard(url);
  }
}

function fallbackCopyToClipboard(text) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    document.execCommand('copy');
    alert('URL gekopieerd naar klembord!');
  } catch (err) {
    alert('Kon URL niet kopiëren. URL: ' + text);
  }

  document.body.removeChild(textArea);
}

// Export for global access
window.getCurrentLocation = getCurrentLocation;
window.showDetails = showDetails;
window.openContactForm = openContactForm;
window.trackEvent = trackEvent;
window.updateFilterState = updateFilterState;
window.toggleAdvancedFilters = toggleAdvancedFilters;