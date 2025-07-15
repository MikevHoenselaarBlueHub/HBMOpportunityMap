// Version configuration will be loaded via script tag

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
  radius: 25,
  searchTerm: ''
};

// Determine page type - improved detection
const isMapPage = window.location.pathname === '/' || 
                  window.location.pathname === '/index.html' ||
                  window.location.pathname.endsWith('/index.html') ||
                  window.location.pathname.endsWith('/');
const isInfoPage = window.location.pathname.includes('info.html');
const isOverPage = window.location.pathname.includes('over.html');

// Only initialize map on the main page
if (isMapPage && !isInfoPage && !isOverPage) {
  // Check if user returned to map page and show notification
  checkForReturnToMapPage();

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

      // Initialize icons with updated colors
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

      // Data laden - with aggressive cache busting
      fetch(`data/opportunities.json?nocache=${Date.now()}&v=${APP_VERSION}`)
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
          console.log('Creating markers for', window.data.length, 'items');
          createMarkers(window.data);

          // Populate filter dropdowns and wait for completion
          await populateFilters(window.data);

          // Load filters from URL (after filters are populated)
          loadFromURL();

          // Apply initial filters
          applyFilters();

          // Initialize auto complete
          initAutocomplete(window.data);

          // Initialize filter functionality
          initializeFilters();

          // Initialize list view
          initializeListView();

          // Show legend
          showLegend();

          // Force update checkboxes after filters are populated
          setTimeout(() => {
            updateCheckboxesFromFilterState();
          }, 500);

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
    if (!response.ok) {
      console.warn(`Translation file not found: ${translationPath}`);
      // Fallback to Dutch if current language fails
      if (currentLanguage !== 'nl') {
        const fallbackResponse = await fetch('translations/nl.json');
        if (fallbackResponse.ok) {
          translations = await fallbackResponse.json();
          return;
        }
      }
      throw new Error('No translation files available');
    }
    translations = await response.json();
  } catch (error) {
    console.warn('Could not load translations, using defaults:', error);
    translations = {
      selectAll: "Selecteer alles",
      selectNone: "Selecteer geen",
      apply: "Toepassen",
      filters: "Filters",
      projects: "Projecten", 
      companies: "Bedrijven",
      results: "resultaten"
    };
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

  // Define base layers
  const streetLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap contributors © CARTO',
    maxZoom: 18
  });

  const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: '© Esri, Maxar, Earthstar Geographics',
    maxZoom: 18
  });

  // Add default street layer
  streetLayer.addTo(map);

  // Initialize municipality layer
  municipalityLayer = L.layerGroup();

  // Add layer control with base layers and overlays
  const layerControl = L.control.layers({
    'Kaart': streetLayer,
    'Satelliet': satelliteLayer
  }, {
    'Gemeentegrenzen': municipalityLayer
  }, {
    position: 'topright'
  }).addTo(map);

  // Lazy load municipality boundaries when layer is added
  let municipalitiesLoaded = false;
  map.on('overlayadd', function(e) {
    if (e.name === 'Gemeentegrenzen' && !municipalitiesLoaded) {
      municipalitiesLoaded = true;
      loadMunicipalityBoundaries();
    }
  });

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
      throw new Error(`HTTP error! status: ${res.status}`);
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
      throw new Error(`HTTP error! status: ${res.status}`);
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

// Create markers with performance optimization
function createMarkers(data) {
  markers.clearLayers();
  console.log('Creating markers for data:', data);

  // Performance optimization: batch marker creation
  const markerBatch = [];
  let markerCount = 0;

  data.forEach(item => {
    if (item.Latitude && item.Longitude) {
      let marker;
      markerCount++;

      // Check if item has an image (Logo for companies, ProjectImage for projects)
      const hasImage = (item.HBMType === 'Bedrijf' && item.Logo) || (item.HBMType === 'Project' && item.ProjectImage);

      if (hasImage) {
        // Create custom image marker
        const imageUrl = item.HBMType === 'Bedrijf' ? item.Logo : item.ProjectImage;
        const borderColor = item.HBMType === 'Project' ? 'rgb(255, 107, 53)' : 'rgb(33, 150, 243)';

        const customIcon = L.divIcon({
          className: item.HBMType === 'Bedrijf' ? 'logo-marker' : 'photo-marker',
          html: `
            <div class="${item.HBMType === 'Bedrijf' ? 'logo-marker-container' : 'photo-marker-container'}" style="border-color: ${borderColor};">
              <img src="${imageUrl}" alt="${item.Name}" class="${item.HBMType === 'Bedrijf' ? 'logo-marker-image' : 'photo-marker-image'}" onerror="this.parentElement.innerHTML='<div class=\\'fallback-marker\\' style=\\'background: ${borderColor}\\'></div>'">
              <div class="${item.HBMType === 'Bedrijf' ? 'logo-marker-overlay' : 'photo-marker-overlay'}"></div>
            </div>
          `,
          iconSize: [50, 50],
          iconAnchor: [25, 25],
          popupAnchor: [0, -25]
        });

        marker = L.marker([item.Latitude, item.Longitude], {
          icon: customIcon
        });
      } else {
        // Create white circle marker with icon
        const iconUrl = item.HBMType === 'Project' ? 'icons/marker-project.svg' : 'icons/marker-company.svg';
        const borderColor = item.HBMType === 'Project' ? 'rgb(255, 107, 53)' : 'rgb(33, 150, 243)';

        const customIcon = L.divIcon({
          className: 'default-marker',
          html: `
            <div class="default-marker-container" style="border-color: ${borderColor};">
              <img src="${iconUrl}" alt="${item.Name}" class="default-marker-icon">
            </div>
          `,
          iconSize: [50, 50],
          iconAnchor: [25, 25],
          popupAnchor: [0, -25]
        });

        marker = L.marker([item.Latitude, item.Longitude], {
          icon: customIcon
        });
      }

      // Create popup content
      const popupContent = createPopupContent(item);
      marker.bindPopup(popupContent, {
        maxWidth: 300,
        className: 'custom-popup'
      });

      // Add hover label functionality
      marker.on('mouseover', function(e) {
        showHoverLabel(e, item.Name || 'Onbekend');
      });

      marker.on('mouseout', function(e) {
        hideHoverLabel();
      });

      // Store item data for filtering
      marker.itemData = item;

      markerBatch.push(marker);
    }
  });

  // Add all markers in batch for better performance
  markerBatch.forEach(marker => markers.addLayer(marker));

  console.log(`Created ${markerCount} markers, total layers:`, markers.getLayers().length);
}

// Hover label functions
let hoverLabelElement = null;

function showHoverLabel(e, text) {
  hideHoverLabel(); // Remove any existing label

  const mapContainer = document.getElementById('map');
  if (!mapContainer) return;

  // Create label element
  hoverLabelElement = document.createElement('div');
  hoverLabelElement.className = 'marker-hover-label';
  hoverLabelElement.textContent = text;

  // Add to map container
  mapContainer.appendChild(hoverLabelElement);

  // Position the label
  positionHoverLabel(e);
}

function positionHoverLabel(e) {
  if (!hoverLabelElement) return;

  const mapContainer = document.getElementById('map');
  const mapRect = mapContainer.getBoundingClientRect();

  // Get mouse position relative to map
  const mouseX = e.originalEvent.clientX - mapRect.left;
  const mouseY = e.originalEvent.clientY - mapRect.top;

  // Get label dimensions
  const labelRect = hoverLabelElement.getBoundingClientRect();
  const labelWidth = labelRect.width;
  const labelHeight = labelRect.height;

  // Calculate position with offset from cursor
  let left = mouseX + 10;
  let top = mouseY - labelHeight - 10;

  // Keep label within map bounds
  if (left + labelWidth > mapRect.width) {
    left = mouseX - labelWidth - 10;
  }
  if (top < 0) {
    top = mouseY + 10;
  }
  if (left < 0) {
    left = 10;
  }

  hoverLabelElement.style.left = left + 'px';
  hoverLabelElement.style.top = top + 'px';
}

function hideHoverLabel() {
  if (hoverLabelElement) {
    hoverLabelElement.remove();
    hoverLabelElement = null;
  }
}

function createPopupContent(item) {
  // Find current item index in filtered data
  const currentData = getCurrentFilteredData();
  const currentIndex = currentData.findIndex(d => d.Name === item.Name);
  const totalItems = currentData.length;

  return `
    <div class="popup-content">
      <div class="popup-navigation">
        <button id="prevPopup" class="nav-btn ${currentIndex === 0 ? 'disabled' : ''}" ${currentIndex === 0 ? 'disabled' : ''} onclick="navigatePopup('${encodeURIComponent(item.Name)}', 'prev')">
          <img src="icons/arrow-left.svg" alt="Vorige" class="nav-icon nav-icon-left" />
        </button>
        <span class="nav-counter">${currentIndex + 1} / ${totalItems}</span>
        <button id="nextPopup" class="nav-btn ${currentIndex === totalItems - 1 ? 'disabled' : ''}" ${currentIndex === totalItems - 1 ? 'disabled' : ''} onclick="navigatePopup('${encodeURIComponent(item.Name)}', 'next')">
          <img src="icons/arrow-right.svg" alt="Volgende" class="nav-icon nav-icon-right" />
        </button>
      </div>
      <h3>${item.Name || 'Onbekend'}</h3>

      ${item.Description ? `<p class="description">${item.Description}</p>` : ''}

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
  const checkedProjectTypes = Array.from(document.querySelectorAll('input[name="ProjectType"]:checked')).map(cb => cb.value);
  const checkedOrganizationTypes = Array.from(document.querySelectorAll('input[name="OrganizationType"]:checked')).map(cb => cb.value);
  const checkedOrganizationFields = Array.from(document.querySelectorAll('input[name="OrganizationField"]:checked')).map(cb => cb.value);
  const checkedHBMTopics = Array.from(document.querySelectorAll('input[name="HBMTopic"]:checked')).map(cb => cb.value);
  const checkedHBMCharacteristics = Array.from(document.querySelectorAll('input[name="HBMCharacteristics"]:checked')).map(cb => cb.value);
  const checkedHBMSectors = Array.from(document.querySelectorAll('input[name="HBMSector"]:checked')).map(cb => cb.value);
  const checkedMunicipalities = Array.from(document.querySelectorAll('input[name="Municipality"]:checked')).map(cb => cb.value);

  const filteredData = window.data.filter(item => {
    // Type filter (Project/Bedrijf checkboxes)
    if (checkedTypes.length > 0 && !checkedTypes.includes(item.HBMType)) {
      return false;
    }

    // ProjectType filter
    if (checkedProjectTypes.length > 0) {
      const itemProjectTypes = Array.isArray(item.ProjectType) ? item.ProjectType : [item.ProjectType].filter(Boolean);
      if (!checkedProjectTypes.some(type => itemProjectTypes.includes(type))) {
        return false;
      }
    }

    // OrganizationType filter
    if (checkedOrganizationTypes.length > 0) {
      const itemOrganizationTypes = Array.isArray(item.OrganizationType) ? item.OrganizationType : [item.OrganizationType].filter(Boolean);
      if (!checkedOrganizationTypes.some(type => itemOrganizationTypes.includes(type))) {
        return false;
      }
    }

    // OrganizationField filter
    if (checkedOrganizationFields.length > 0) {
      const itemFields = Array.isArray(item.OrganizationField) ? item.OrganizationField : [item.OrganizationField].filter(Boolean);
      if (!checkedOrganizationFields.some(field => itemFields.includes(field))) {
        return false;
      }
    }

    // HBMTopic filter - use filterState if form values are empty
    const activeHBMTopics = checkedHBMTopics.length > 0 ? checkedHBMTopics : (filterState.checkedFilters['HBMTopic'] || []);
    if (activeHBMTopics.length > 0) {
      const itemTopics = Array.isArray(item.HBMTopic) ? item.HBMTopic : [item.HBMTopic].filter(Boolean);
      if (!activeHBMTopics.some(topic => itemTopics.includes(topic))) {
        return false;
      }
    }

    // HBMCharacteristics filter - use filterState if form values are empty
    const activeHBMCharacteristics = checkedHBMCharacteristics.length > 0 ? checkedHBMCharacteristics : (filterState.checkedFilters['HBMCharacteristics'] || []);
    if (activeHBMCharacteristics.length > 0) {
      const itemCharacteristics = Array.isArray(item.HBMCharacteristics) ? item.HBMCharacteristics : [item.HBMCharacteristics].filter(Boolean);
      if (!activeHBMCharacteristics.some(characteristic => itemCharacteristics.includes(characteristic))) {
        return false;
      }
    }

    // HBMSector filter - use filterState if form values are empty
    const activeHBMSectors = checkedHBMSectors.length > 0 ? checkedHBMSectors : (filterState.checkedFilters['HBMSector'] || []);
    if (activeHBMSectors.length > 0) {
      const itemSectors = Array.isArray(item.HBMSector) ? item.HBMSector : [item.HBMSector].filter(Boolean);
      if (!activeHBMSectors.some(sector => itemSectors.includes(sector))) {
        return false;
      }
    }

    // Municipality filter - use filterState if form values are empty
    const activeMunicipalities = checkedMunicipalities.length > 0 ? checkedMunicipalities : (filterState.checkedFilters['Municipality'] || []);
    if (activeMunicipalities.length > 0 && !activeMunicipalities.includes(item.Municipality)) {
      return false;
    }

    // Search filter
    if (currentFilter.searchTerm) {
      const searchLower = currentFilter.searchTerm.toLowerCase();
      const nameMatch = item.Name && item.Name.toLowerCase().includes(searchLower);
      const descMatch = item.Description && item.Description.toLowerCase().includes(searchLower);
      if (!nameMatch && !descMatch) {
        return false;
      }
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

  // Synchronize tab based on current filter types
  if (filterState.checkedTypes && filterState.checkedTypes.length === 1) {
    synchronizeTabWithTypes(filterState.checkedTypes);
  }

  // Update checkboxes after filters are populated
  updateCheckboxesFromFilterState();
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

// Format array with clickable filter links
function formatArrayWithLinks(value, filterType, currentType) {
  if (Array.isArray(value)) {
    const typeLabel = currentType === 'Project' ? 'projecten' : 'bedrijven';
    return value.map(val => 
      `<span class="filter-link" onclick="applyFilterFromDetail('${filterType}', '${encodeURIComponent(val)}', '${currentType}')" title="Bekijk alle ${typeLabel} met kenmerk ${val}">${val}</span>`
    ).join(', ');
  }
  return value ? formatSingleValueWithLink(value, filterType, currentType) : '';
}

// Format single value with clickable filter link
function formatSingleValueWithLink(value, filterType, currentType) {
  if (!value) return '';
  const typeLabel = currentType === 'Project' ? 'projecten' : 'bedrijven';
  return `<span class="filter-link" onclick="applyFilterFromDetail('${filterType}', '${encodeURIComponent(value)}', '${currentType}')" title="Bekijk alle ${typeLabel} met kenmerk ${value}">${value}</span>`;
}

// Apply filter from detail panel link
function applyFilterFromDetail(filterType, filterValue, currentType) {
  const decodedValue = decodeURIComponent(filterValue);

  // Clear all existing filters first
  document.querySelectorAll('#filtersForm input[type="checkbox"]').forEach(cb => {
    cb.checked = false;
  });

  // Set the type filter (Project or Bedrijf)
  document.querySelectorAll('input[name="HBMType"]').forEach(cb => {
    if (cb.value === currentType) {
      cb.checked = true;
    }
  });

  // Set the specific filter value
  const filterCheckbox = document.querySelector(`input[name="${filterType}"][value="${decodedValue}"]`);
  if (filterCheckbox) {
    filterCheckbox.checked = true;
  }

  // Close detail panel
  const detailPanel = document.getElementById('detailPanel');
  if (detailPanel) {
    detailPanel.classList.remove('open');
  }

  // Update filter state and apply filters
  updateFilterState();

  // Track event
  trackEvent('filter_from_detail', {
    filter_type: filterType,
    filter_value: decodedValue,
    current_type: currentType
  });
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

      const distanceRangeEl = document.getElementById('distanceRange');
      const distanceValueEl = document.getElementById('distanceValue');
      if (distanceRangeEl && distanceValueEl) {
        distanceRangeEl.value = radius;
        distanceValueEl.textContent = radius + ' km';
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

async function populateFilters(data) {
  try {
    // Load filter options from filters.json
    const filtersResponse = await fetch(`data/filters.json?nocache=${Date.now()}&v=${APP_VERSION}`);
    const filterOptions = await filtersResponse.json();

    // Load municipalities from municipalities.json
    const municipalitiesResponse = await fetch(`data/municipalities.json?nocache=${Date.now()}&v=${APP_VERSION}`);
    const municipalitiesData = await municipalitiesResponse.json();
    const municipalities = municipalitiesData.municipalities.map(m => m.name).sort();

    console.log('Filter data:', {
      ...filterOptions,
      municipalities
    });

    // Populate filter sections
    populateFilterSection('ProjectType', filterOptions.ProjectType);
    populateFilterSection('OrganizationType', filterOptions.OrganizationType);
    populateFilterSection('OrganizationField', filterOptions.OrganizationField);
    populateFilterSection('HBMTopic', filterOptions.HBMTopic);
    populateFilterSection('HBMCharacteristics', filterOptions.HBMCharacteristics);
    populateFilterSection('HBMSector', filterOptions.HBMSector);
    populateFilterSection('Municipality', municipalities);

    // Add municipality selection buttons with config data
    addMunicipalitySelectionButtons(municipalitiesData.municipalities);

    // Return promise to indicate completion
    return Promise.resolve();

  } catch (error) {
    console.error('Error loading filters:', error);
    // Fallback to generating from data
    populateFiltersFromData(data);
    return Promise.resolve();
  }
}

function populateFiltersFromData(data) {
  // Get unique values for each filter as fallback
  const projectTypes = [...new Set(data.flatMap(item => 
    Array.isArray(item.ProjectType) ? item.ProjectType : [item.ProjectType]
  ).filter(Boolean))].sort();

  const organizations = [...new Set(data.flatMap(item => 
    Array.isArray(item.OrganizationType) ? item.OrganizationType : [item.OrganizationType]
  ).filter(Boolean))].sort();

  const organizationFields = [...new Set(data.flatMap(item => 
    Array.isArray(item.OrganizationField) ? item.OrganizationField : [item.OrganizationField]
  ).filter(Boolean))].sort();

  const topics = [...new Set(data.flatMap(item => 
    Array.isArray(item.HBMTopic) ? item.HBMTopic : [item.HBMTopic]
  ).filter(Boolean))].sort();

  const characteristics = [...new Set(data.flatMap(item => 
    Array.isArray(item.HBMCharacteristics) ? item.HBMCharacteristics : [item.HBMCharacteristics]
  ).filter(Boolean))].sort();

  const sectors = [...new Set(data.flatMap(item => 
    Array.isArray(item.HBMSector) ? item.HBMSector : [item.HBMSector]
  ).filter(Boolean))].sort();

  const municipalities = [...new Set(data.map(item => item.Municipality).filter(Boolean))].sort();

  // Populate filter sections
  populateFilterSection('ProjectType', projectTypes);
  populateFilterSection('OrganizationType', organizations);
  populateFilterSection('OrganizationField', organizationFields);
  populateFilterSection('HBMTopic', topics);
  populateFilterSection('HBMCharacteristics', characteristics);
  populateFilterSection('HBMSector', sectors);
  populateFilterSection('Municipality', municipalities);

  // Add municipality selection buttons
  addMunicipalitySelectionButtons(data);
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
      e.stopPropagation();      filterDropdown.classList.toggle('open');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
      if (!filterDropdown.contains(e.target)) {
        filterDropdown.classList.remove('open');
      }
    });
  }

  // Export functionality
  document.getElementById('exportBtn')?.addEventListener('click', () => {
    exportResultsToCSV();
  });

  const saveCurrentFiltersBtn = document.getElementById('saveCurrentFiltersBtn');
  if (saveCurrentFiltersBtn) {
    saveCurrentFiltersBtn.addEventListener('click', saveCurrentFilters);
  }

  // Load saved filters
  document.getElementById('loadSavedFiltersBtn')?.addEventListener('click', () => {
    loadSavedFilters();
  });

  const showAllResultsBtn = document.getElementById('showAllResultsBtn');
  if (showAllResultsBtn) {
    showAllResultsBtn.addEventListener('click', function() {
      showAllResults();
      // Close dropdown after action
      const filterDropdown = document.querySelector('.filter-dropdown');
      if (filterDropdown) {
        filterDropdown.classList.remove('open');
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
  const distanceSlider = document.getElementById('distanceRange');
  const distanceDisplay = document.getElementById('distanceValue');
  if (distanceSlider && distanceDisplay) {
    distanceSlider.addEventListener('input', function() {
      const value = parseInt(this.value);
      distanceDisplay.textContent = value + ' km';
      updateLocationRadius(value);
    });
  }

  // Search functionality
  const searchInput = document.getElementById('mapSearch');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      const searchTerm = this.value.trim();
      currentFilter.searchTerm = searchTerm;
      filterState.searchTerm = searchTerm;

      updateURL();
      applyFilters();
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
    buildingsList.innerHTML = `
      <div class="no-results-opportunity">
        <h2>Geen projecten gevonden</h2>
        <p>Er zijn nog geen resultaten voor deze selectie gevonden. Dit biedt kansen. HBM helpt graag bij het verbinden van de juiste partners voor de realisatie van gezonde gebouwen, beleidsmakers binnen gemeenten.</p>
        <div class="no-results-actions">
          <a href="contact.html" class="btn-primary">Contact opnemen</a>
          <a href="over.html" class="text-link">Meer over HBM</a>
        </div>
      </div>
    `;
  } else {
    projects.forEach(item => {
      buildingsList.appendChild(createListItem(item));
    });
  }

  // Add companies to companies list
  if (companies.length === 0) {
    companiesList.innerHTML = `
      <div class="no-results-opportunity">
        <h2>Geen bedrijven gevonden</h2>
        <p>Er zijn nog geen resultaten voor deze selectie gevonden. Dit biedt kansen. HBM helpt graag bij het verbinden van de juiste partners voor de realisatie van gezonde gebouwen, beleidsmakers binnen gemeenten.</p>
        <div class="no-results-actions">
          <a href="contact.html" class="btn-primary">Contact opnemen</a>
          <a href="over.html" class="text-link">Meer over HBM</a>
        </div>
      </div>
    `;
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

// Popup navigation function
function navigatePopup(currentItemName, direction) {
  const decodedName = decodeURIComponent(currentItemName);
  const currentData = getCurrentFilteredData();
  const currentIndex = currentData.findIndex(d => d.Name === decodedName);

  let newIndex;
  if (direction === 'prev' && currentIndex > 0) {
    newIndex = currentIndex - 1;
  } else if (direction === 'next' && currentIndex < currentData.length - 1) {
    newIndex = currentIndex + 1;
  } else {
    return; // No navigation possible
  }

  const newItem = currentData[newIndex];
  if (newItem && newItem.Latitude && newItem.Longitude) {
    // Close current popup
    map.closePopup();

    // Find the marker for the new item in the current visible markers
    let targetMarker = null;
    markers.eachLayer(function(marker) {
      if (marker.itemData && marker.itemData.Name === newItem.Name) {
        targetMarker = marker;
      }
    });

    if (targetMarker) {
      // Center map on new marker
      map.setView([newItem.Latitude, newItem.Longitude], map.getZoom());

      // Open popup for new marker
      setTimeout(() => {
        targetMarker.openPopup();
      }, 100);
    }
  }
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
          <img src="icons/arrow-left.svg" alt="Vorige" class="nav-icon nav-icon-left" />
        </button>
        <span class="nav-counter">${currentIndex + 1} / ${totalItems}</span>
        <button id="nextDetail" class="nav-btn ${currentIndex === totalItems - 1 ? 'disabled' : ''}" ${currentIndex === totalItems - 1 ? 'disabled' : ''}>
          <img src="icons/arrow-right.svg" alt="Volgende" class="nav-icon nav-icon-right" />
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
          ${item.ProjectType ? `<div class="detail-row"><strong>Project Type:</strong> ${formatArrayWithLinks(item.ProjectType, 'ProjectType', item.HBMType)}</div>` : ''}
          ${item.OrganizationType ? `<div class="detail-row"><strong>Organisatie:</strong> ${formatSingleValueWithLink(item.OrganizationType, 'OrganizationType', item.HBMType)}</div>` : ''}
          ${item.OrganizationField ? `<div class="detail-row"><strong>Vakgebied:</strong> ${formatArrayWithLinks(item.OrganizationField, 'OrganizationField', item.HBMType)}</div>` : ''}
          ${item.HBMTopic ? `<div class="detail-row"><strong>HBM Onderwerp:</strong> ${formatArrayWithLinks(item.HBMTopic, 'HBMTopic', item.HBMType)}</div>` : ''}
          ${item.HBMCharacteristics ? `<div class="detail-row"><strong>Kenmerken:</strong> ${formatArrayWithLinks(item.HBMCharacteristics, 'HBMCharacteristics', item.HBMType)}</div>` : ''}
          ${item.HBMSector ? `<div class="detail-row"><strong>Sector:</strong> ${formatSingleValueWithLink(item.HBMSector, 'HBMSector', item.HBMType)}</div>` : ''}
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
  const checkedProjectTypes = Array.from(document.querySelectorAll('input[name="ProjectType"]:checked')).map(cb => cb.value);
  const checkedOrganizationTypes = Array.from(document.querySelectorAll('input[name="OrganizationType"]:checked')).map(cb => cb.value);
  const checkedOrganizationFields = Array.from(document.querySelectorAll('input[name="OrganizationField"]:checked')).map(cb => cb.value);
  const checkedHBMTopics = Array.from(document.querySelectorAll('input[name="HBMTopic"]:checked')).map(cb => cb.value);
  const checkedHBMCharacteristics = Array.from(document.querySelectorAll('input[name="HBMCharacteristics"]:checked')).map(cb => cb.value);
  const checkedHBMSectors = Array.from(document.querySelectorAll('input[name="HBMSector"]:checked')).map(cb => cb.value);
  const checkedMunicipalities = Array.from(document.querySelectorAll('input[name="Municipality"]:checked')).map(cb => cb.value);

  return window.data.filter(item => {
    // Type filter (Project/Bedrijf checkboxes)
    if (checkedTypes.length > 0 && !checkedTypes.includes(item.HBMType)) {
      return false;
    }

    // ProjectType filter
    if (checkedProjectTypes.length > 0) {
      const itemProjectTypes = Array.isArray(item.ProjectType) ? item.ProjectType : [item.ProjectType].filter(Boolean);
      if (!checkedProjectTypes.some(type => itemProjectTypes.includes(type))) {
        return false;
      }
    }

    // OrganizationType filter
    if (checkedOrganizationTypes.length > 0) {
      const itemOrganizationTypes = Array.isArray(item.OrganizationType) ? item.OrganizationType : [item.OrganizationType].filter(Boolean);
      if (!checkedOrganizationTypes.some(type => itemOrganizationTypes.includes(type))) {
        return false;
      }
    }

    // OrganizationField filter
    if (checkedOrganizationFields.length > 0) {
      const itemFields = Array.isArray(item.OrganizationField) ? item.OrganizationField : [item.OrganizationField].filter(Boolean);
      if (!checkedOrganizationFields.some(field => itemFields.includes(field))) {
        return false;
      }
    }

    // HBMTopic filter - use filterState if form values are empty
    const activeHBMTopics = checkedHBMTopics.length > 0 ? checkedHBMTopics : (filterState.checkedFilters['HBMTopic'] || []);
    if (activeHBMTopics.length > 0) {
      const itemTopics = Array.isArray(item.HBMTopic) ? item.HBMTopic : [item.HBMTopic].filter(Boolean);
      if (!activeHBMTopics.some(topic => itemTopics.includes(topic))) {
        return false;
      }
    }

    // HBMCharacteristics filter - use filterState if form values are empty
    const activeHBMCharacteristics = checkedHBMCharacteristics.length > 0 ? checkedHBMCharacteristics : (filterState.checkedFilters['HBMCharacteristics'] || []);
    if (activeHBMCharacteristics.length > 0) {
      const itemCharacteristics = Array.isArray(item.HBMCharacteristics) ? item.HBMCharacteristics : [item.HBMCharacteristics].filter(Boolean);
      if (!activeHBMCharacteristics.some(characteristic => itemCharacteristics.includes(characteristic))) {
        return false;
      }
    }

    // HBMSector filter - use filterState if form values are empty
    const activeHBMSectors = checkedHBMSectors.length > 0 ? checkedHBMSectors : (filterState.checkedFilters['HBMSector'] || []);
    if (activeHBMSectors.length > 0) {
      const itemSectors = Array.isArray(item.HBMSector) ? item.HBMSector : [item.HBMSector].filter(Boolean);
      if (!activeHBMSectors.some(sector => itemSectors.includes(sector))) {
        return false;
      }
    }

    // Municipality filter - use filterState if form values are empty
    const activeMunicipalities = checkedMunicipalities.length > 0 ? checkedMunicipalities : (filterState.checkedFilters['Municipality'] || []);
    if (activeMunicipalities.length > 0 && !activeMunicipalities.includes(item.Municipality)) {
      return false;
    }

    // Search filter
    if (currentFilter.searchTerm) {
      const searchLower = currentFilter.searchTerm.toLowerCase();
      const nameMatch = item.Name && item.Name.toLowerCase().includes(searchLower);
      const descMatch = item.Description && item.Description.toLowerCase().includes(searchLower);
      if (!nameMatch && !descMatch) {
        return false;
      }
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
  const filterSections = ['ProjectType', 'OrganizationType', 'OrganizationField', 'HBMTopic', 'HBMCharacteristics', 'HBMSector', 'Municipality'];
  filterState.checkedFilters = {};

  filterSections.forEach(section => {
    const checked = Array.from(document.querySelectorAll(`input[name="${section}"]:checked`)).map(cb => cb.value);
    if (checked.length > 0) {
      filterState.checkedFilters[section] = checked;
    }
  });

  // Update current filter for URL state
  currentFilter = {
    ...currentFilter,
    checkedTypes: checkedTypes,
    checkedFilters: filterState.checkedFilters
  };

  // Update URL
  updateURL();

  applyFilters();
}

function addMunicipalitySelectionButtons(municipalitiesConfig) {
  const municipalitySection = document.getElementById('Municipality');
  if (!municipalitySection) return;

  // Add selection buttons at the top
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'municipality-selection-buttons';
  buttonContainer.innerHTML = `
    <button type="button" id="selectNLMunicipalities" class="municipality-btn">Selecteer alleen Nederlandse gemeenten</button>
    <button type="button" id="selectDEMunicipalities" class="municipality-btn">Selecteer alleen Duitse gemeenten</button>
    <button type="button" id="selectAllMunicipalities" class="municipality-btn">Selecteer alle gemeenten</button>
    <button type="button" id="clearAllMunicipalities" class="municipality-btn">Deselecteer alle gemeenten</button>
  `;

  municipalitySection.insertBefore(buttonContainer, municipalitySection.firstChild);

  // Get municipalities by country from config
  const nlMunicipalities = municipalitiesConfig.filter(m => m.code === 'NL').map(m => m.name);
  const deMunicipalities = municipalitiesConfig.filter(m => m.code === 'DE').map(m => m.name);

  // Add event listeners
  document.getElementById('selectNLMunicipalities').addEventListener('click', () => {
    // Uncheck all first
    document.querySelectorAll('input[name="Municipality"]').forEach(cb => cb.checked = false);
    // Check only Dutch municipalities
    nlMunicipalities.forEach(municipality => {
      const checkbox = document.querySelector(`input[name="Municipality"][value="${municipality}"]`);
      if (checkbox) checkbox.checked = true;
    });
    updateFilterState();
  });

  document.getElementById('selectDEMunicipalities').addEventListener('click', () => {
    // Uncheck all first
    document.querySelectorAll('input[name="Municipality"]').forEach(cb => cb.checked = false);
    // Check only German municipalities
    deMunicipalities.forEach(municipality => {
      const checkbox = document.querySelector(`input[name="Municipality"][value="${municipality}"]`);
      if (checkbox) checkbox.checked = true;
    });
    updateFilterState();
  });

  document.getElementById('selectAllMunicipalities').addEventListener('click', () => {
    document.querySelectorAll('input[name="Municipality"]').forEach(cb => cb.checked = true);
    updateFilterState();
  });

  document.getElementById('clearAllMunicipalities').addEventListener('click', () => {
    document.querySelectorAll('input[name="Municipality"]').forEach(cb => cb.checked = false);
    updateFilterState();
  });
}

function toggleAdvancedFilters() {
  const advancedFilters = document.getElementById('advancedFilters');
  if (advancedFilters) {
    advancedFilters.classList.toggle('open');
  }
}

// URL state management
function updateURL() {
  try {
    const params = new URLSearchParams();

    // Add search term
    if (currentFilter.searchTerm) {
      params.set('search', currentFilter.searchTerm);
    }

    // Add types
    if (filterState.checkedTypes && filterState.checkedTypes.length > 0) {
      params.set('types', filterState.checkedTypes.join(','));
    }

    // Add other filters
    if (filterState.checkedFilters) {
      Object.keys(filterState.checkedFilters).forEach(section => {
        if (filterState.checkedFilters[section] && filterState.checkedFilters[section].length > 0) {
          params.set(section.toLowerCase(), filterState.checkedFilters[section].join(','));
        }
      });
    }

    // Add location if set
    if (currentFilter.userLocation) {
      params.set('lat', currentFilter.userLocation.lat.toString());
      params.set('lng', currentFilter.userLocation.lng.toString());
      params.set('radius', (currentFilter.radius / 1000).toString());
    }

    const newURL = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
    window.history.replaceState({}, '', newURL);
  } catch (error) {
    console.error('Error updating URL:', error);
  }
}

function loadFromURL() {
  const params = new URLSearchParams(window.location.search);

  // Load search term
  if (params.has('search')) {
    const searchTerm = params.get('search');
    filterState.searchTerm = searchTerm;
    currentFilter.searchTerm = searchTerm;

    // Update search input
    const searchInput = document.getElementById('mapSearch');
    if (searchInput) {
      searchInput.value = searchTerm;
    }
  }

  // Load filter types
  if (params.has('types')) {
    const types = params.get('types').split(',');
    filterState.checkedTypes = types;

    // Update checkboxes
    document.querySelectorAll('input[name="HBMType"]').forEach(cb => {
      cb.checked = types.includes(cb.value);
    });

    // Synchronize tab selection based on types
    synchronizeTabWithTypes(types);
  }

  // Check for specific filter parameters that should activate tabs
  if (params.has('projecttype')) {
    // If projecttype is specified, show projects tab
    activateTab('buildings');
  }

  // Load other filters - mapping URL parameters to filter sections
  const filterSections = [
    { section: 'ProjectType', param: 'projecttype' },
    { section: 'OrganizationType', param: 'organizationtype' },
    { section: 'OrganizationField', param: 'organizationfield' },
    { section: 'HBMTopic', param: 'hbmtopic' },
    { section: 'HBMCharacteristics', param: 'hbmcharacteristics' },
    { section: 'HBMSector', param: 'hbmsector' },
    { section: 'Municipality', param: 'municipality' }
  ];

  filterSections.forEach(({ section, param }) => {
    if (params.has(param)) {
      const values = params.get(param).split(',');
      filterState.checkedFilters[section] = values;

      // Update checkboxes immediately
      document.querySelectorAll(`input[name="${section}"]`).forEach(cb => {
        cb.checked = values.includes(cb.value);
      });
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

      const distanceRangeEl = document.getElementById('distanceRange');
      const distanceValueEl = document.getElementById('distanceValue');
      if (distanceRangeEl && distanceValueEl) {
        distanceRangeEl.value = radius;
        distanceValueEl.textContent = radius + ' km';
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

  // Update filter state with current search term
  const searchInput = document.getElementById('mapSearch');
  if (searchInput) {
    filterState.searchTerm = searchInput.value.trim();
  }

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

  // Ensure checkedFilters exists
  if (!filterState.checkedFilters) {
    filterState.checkedFilters = {};
  }

  // Ensure checkedTypes exists and has default values
  if (!filterState.checkedTypes) {
    filterState.checkedTypes = ['Project', 'Bedrijf'];
  }

  // Update UI - HBMType checkboxes
  document.querySelectorAll('input[name="HBMType"]').forEach(cb => {
    cb.checked = filterState.checkedTypes.includes(cb.value);
  });

  // Clear all other checkboxes first
  const filterSections = ['ProjectType', 'OrganizationType', 'OrganizationField', 'HBMTopic', 'HBMCharacteristics', 'HBMSector', 'Municipality'];
  filterSections.forEach(section => {
    document.querySelectorAll(`input[name="${section}"]`).forEach(cb => {
      cb.checked = false;
    });
  });

  // Set saved filter checkboxes
  Object.keys(filterState.checkedFilters).forEach(section => {
    if (filterState.checkedFilters[section] && Array.isArray(filterState.checkedFilters[section])) {
      filterState.checkedFilters[section].forEach(value => {
        const checkbox = document.querySelector(`input[name="${section}"][value="${value}"]`);
        if (checkbox) {
          checkbox.checked = true;
        }
      });
    }
  });

  // Load search term if saved
  if (filterState.searchTerm) {
    currentFilter.searchTerm = filterState.searchTerm;
    const searchInput = document.getElementById('mapSearch');
    if (searchInput) {
      searchInput.value = filterState.searchTerm;
    }
  } else {
    // Clear search if not in saved filter
    currentFilter.searchTerm = '';
    const searchInput = document.getElementById('mapSearch');
    if (searchInput) {
      searchInput.value = '';
    }
  }

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

      const distanceRangeEl = document.getElementById('distanceRange');
      const distanceValueEl = document.getElementById('distanceValue');
      if (distanceRangeEl && distanceValueEl) {
        distanceRangeEl.value = filterState.radius;
        distanceValueEl.textContent = filterState.radius + ' km';
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
  } else {
    // Clear location if not in saved filter
    currentFilter.userLocation = null;
    currentFilter.radius = null;

    // Remove user location marker and circle
    if (userLocationCircle) {
      map.removeLayer(userLocationCircle);
      userLocationCircle = null;
    }

    // Update UI
    const distanceFilter = document.getElementById('distanceFilter');
    if (distanceFilter) {
      distanceFilter.style.display = 'none';
    }

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
  }

  // Apply filters first to ensure proper state
  applyFilters();

  // Update URL immediately after loading filter
  updateURL();

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

// Function to synchronize tab with types parameter
function synchronizeTabWithTypes(types) {
  if (types.length === 1) {
    // Only one type selected, switch to appropriate tab
    if (types.includes('Project')) {
      activateTab('buildings');
    } else if (types.includes('Bedrijf')) {
      activateTab('companies');
    }
  }
}

// Function to activate specific tab
function activateTab(tabName) {
  setTimeout(() => {
    // Remove active class from all tabs
    const tabButtons = document.querySelectorAll('.list-tab');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabPanes.forEach(pane => pane.classList.remove('active'));

    // Add active class to specified tab
    const targetButton = document.querySelector(`[data-tab="${tabName}"]`);
    const targetPane = document.getElementById(tabName + 'Tab');

    if (targetButton) {
      targetButton.classList.add('active');
    }
    if (targetPane) {
      targetPane.classList.add('active');
    }
  }, 100);
}

// CSV Export functionality
function exportResultsToCSV() {
  try {
    // Get current filtered data
    const filteredData = getCurrentFilteredData();

    if (filteredData.length === 0) {
      alert('Geen resultaten om te exporteren');
      return;
    }

    // Define CSV headers
    const headers = [
      'Naam',
      'Type Project', 
      'Organisatietype',
      'Vakgebied',
      'Thema',
      'Kenmerken', 
      'Sector',
      'Type',
      'Beschrijving',
      'Stad',
      'Gemeente',
      'Land',
      'Latitude',
      'Longitude'
    ];

    // Convert data to CSV format
    const csvContent = [
      headers.join(','),
      ...filteredData.map(item => [
        `"${item.Name || ''}"`,
        `"${Array.isArray(item.ProjectType) ? item.ProjectType.join('; ') : item.ProjectType || ''}"`,
        `"${item.OrganizationType || ''}"`,
        `"${Array.isArray(item.OrganizationField) ? item.OrganizationField.join('; ') : item.OrganizationField || ''}"`,
        `"${Array.isArray(item.HBMTopic) ? item.HBMTopic.join('; ') : item.HBMTopic || ''}"`,
        `"${Array.isArray(item.HBMCharacteristics) ? item.HBMCharacteristics.join('; ') : item.HBMCharacteristics || ''}"`,
        `"${item.HBMSector || ''}"`,
        `"${item.HBMType || ''}"`,
        `"${item.Description || ''}"`,
        `"${item.City || ''}"`,
        `"${item.Municipality || ''}"`,
        `"${item.Country || ''}"`,
        item.Latitude || '',
        item.Longitude || ''
      ].join(','))
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');

    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `hbm-kansenkaart-resultaten-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  } catch (error) {
    console.error('Error exporting CSV:', error);
    alert('Er is een fout opgetreden bij het exporteren');
  }
}

// Show all results function
function showAllResults() {
  const currentData = getCurrentFilteredData();

  if (currentData.length === 0) {
    alert('Geen resultaten om te tonen.');
    return;
  }

  // Get all coordinates from current filtered data
  const validCoordinates = currentData
    .filter(item => item.Latitude && item.Longitude)
    .map(item => [item.Latitude, item.Longitude]);

  if (validCoordinates.length === 0) {
    alert('Geen geldige coördinaten gevonden voor huidige resultaten.');
    return;
  }

  // Create a bounds object from all coordinates
  const bounds = L.latLngBounds(validCoordinates);

  // Fit the map to show all results with some padding
  map.fitBounds(bounds, {
    padding: [50, 50], // Add 50px padding on all sides
    maxZoom: 15 // Don't zoom in too far
  });

  // Track the event
  trackEvent('show_all_results', {
    result_count: currentData.length,
    bounds_northeast: bounds.getNorthEast(),
    bounds_southwest: bounds.getSouthWest()
  });

  console.log(`Centered map to show all ${currentData.length} results`);
}

function closeAllOverlays() {
  const filterOverlay = document.getElementById('filterOverlay');
  if (filterOverlay && filterOverlay.classList.contains('open')) {
    filterOverlay.classList.remove('open');
  }

  const detailPanel = document.getElementById('detailPanel');
  if (detailPanel && detailPanel.classList.contains('open')) {
    detailPanel.classList.remove('open');
  }

  const menuOverlay = document.getElementById('menuOverlay');
  if (menuOverlay && menuOverlay.classList.contains('open')) {
    menuOverlay.classList.remove('open');
  }
}

function getFilteredData() {
    // Get filter values from form
    const checkedTypes = Array.from(document.querySelectorAll('input[name="HBMType"]:checked')).map(cb => cb.value);
    const checkedProjectTypes = Array.from(document.querySelectorAll('input[name="ProjectType"]:checked')).map(cb => cb.value);
    const checkedOrganizationTypes = Array.from(document.querySelectorAll('input[name="OrganizationType"]:checked')).map(cb => cb.value);
    const checkedOrganizationFields = Array.from(document.querySelectorAll('input[name="OrganizationField"]:checked')).map(cb => cb.value);
    const checkedHBMTopics = Array.from(document.querySelectorAll('input[name="HBMTopic"]:checked')).map(cb => cb.value);
    const checkedHBMCharacteristics = Array.from(document.querySelectorAll('input[name="HBMCharacteristics"]:checked')).map(cb => cb.value);
    const checkedHBMSectors = Array.from(document.querySelectorAll('input[name="HBMSector"]:checked')).map(cb => cb.value);
    const checkedMunicipalities = Array.from(document.querySelectorAll('input[name="Municipality"]:checked')).map(cb => cb.value);

    return window.data.filter(item => {
      // Type filter (Project/Bedrijf checkboxes)
      if (checkedTypes.length > 0 && !checkedTypes.includes(item.HBMType)) {
        return false;
      }

      // ProjectType filter
      if (checkedProjectTypes.length > 0) {
        const itemProjectTypes = Array.isArray(item.ProjectType) ? item.ProjectType : [item.ProjectType].filter(Boolean);
        if (!checkedProjectTypes.some(type => itemProjectTypes.includes(type))) {
          return false;
        }
      }

      // OrganizationType filter
      if (checkedOrganizationTypes.length > 0) {
        const itemOrganizationTypes = Array.isArray(item.OrganizationType) ? item.OrganizationType : [item.OrganizationType].filter(Boolean);
        if (!checkedOrganizationTypes.some(type => itemOrganizationTypes.includes(type))) {
          return false;
        }
      }

      // OrganizationField filter
      if (checkedOrganizationFields.length > 0) {
        const itemFields = Array.isArray(item.OrganizationField) ? item.OrganizationField : [item.OrganizationField].filter(Boolean);
        if (!checkedOrganizationFields.some(field => itemFields.includes(field))) {
          return false;
        }
      }

      // HBMTopic filter - use filterState if form values are empty
      const activeHBMTopics = checkedHBMTopics.length > 0 ? checkedHBMTopics : (filterState.checkedFilters['HBMTopic'] || []);
      if (activeHBMTopics.length > 0) {
        const itemTopics = Array.isArray(item.HBMTopic) ? item.HBMTopic : [item.HBMTopic].filter(Boolean);
        if (!activeHBMTopics.some(topic => itemTopics.includes(topic))) {
          return false;
        }
      }

      // HBMCharacteristics filter - use filterState if form values are empty
      const activeHBMCharacteristics = checkedHBMCharacteristics.length > 0 ? checkedHBMCharacteristics : (filterState.checkedFilters['HBMCharacteristics'] || []);
      if (activeHBMCharacteristics.length > 0) {
        const itemCharacteristics = Array.isArray(item.HBMCharacteristics) ? item.HBMCharacteristics : [item.HBMCharacteristics].filter(Boolean);
        if (!activeHBMCharacteristics.some(characteristic => itemCharacteristics.includes(characteristic))) {
          return false;
        }
      }

      // HBMSector filter - use filterState if form values are empty
      const activeHBMSectors = checkedHBMSectors.length > 0 ? checkedHBMSectors : (filterState.checkedFilters['HBMSector'] || []);
      if (activeHBMSectors.length > 0) {
        const itemSectors = Array.isArray(item.HBMSector) ? item.HBMSector : [item.HBMSector].filter(Boolean);
        if (!activeHBMSectors.some(sector => itemSectors.includes(sector))) {
          return false;
        }
      }

      // Municipality filter - use filterState if form values are empty
      const activeMunicipalities = checkedMunicipalities.length > 0 ? checkedMunicipalities : (filterState.checkedFilters['Municipality'] || []);
      if (activeMunicipalities.length > 0 && !activeMunicipalities.includes(item.Municipality)) {
        return false;
      }

      // Search filter
      if (currentFilter.searchTerm) {
        const searchLower = currentFilter.searchTerm.toLowerCase();
        const nameMatch = item.Name && item.Name.toLowerCase().includes(searchLower);
        const descMatch = item.Description && item.Description.toLowerCase().includes(searchLower);
        if (!nameMatch && !descMatch) {
          return false;
        }
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

// Check if user returned to map page and show notification
function checkForReturnToMapPage() {
  // Check if there's a stored filter state and user came from another page
  const lastFilterState = localStorage.getItem('hbm_last_filter_state');
  const lastPageVisit = localStorage.getItem('hbm_last_page_visit');
  const currentTime = Date.now();
  
  // Only show notification if:
  // 1. There's a stored filter state
  // 2. User visited another page recently (within 30 minutes)
  // 3. Current URL doesn't already have filters
  if (lastFilterState && lastPageVisit && 
      (currentTime - parseInt(lastPageVisit) < 30 * 60 * 1000) && 
      !window.location.search) {
    
    // Show notification after a brief delay
    setTimeout(() => {
      showLastFilterNotification();
    }, 1000);
  }
}

function showLastFilterNotification() {
  const notification = document.getElementById('lastFilterNotification');
  const useLastFilterLink = document.getElementById('useLastFilterLink');
  const closeNotification = document.getElementById('closeNotification');
  
  if (notification) {
    notification.style.display = 'block';
    
    // Handle "Ja" click
    useLastFilterLink.addEventListener('click', function(e) {
      e.preventDefault();
      loadLastFilterState();
      hideLastFilterNotification();
    });
    
    // Handle close button
    closeNotification.addEventListener('click', function() {
      hideLastFilterNotification();
    });
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
      hideLastFilterNotification();
    }, 10000);
  }
}

function hideLastFilterNotification() {
  const notification = document.getElementById('lastFilterNotification');
  if (notification) {
    notification.style.display = 'none';
  }
}

function loadLastFilterState() {
  const lastFilterState = localStorage.getItem('hbm_last_filter_state');
  if (lastFilterState) {
    try {
      const savedState = JSON.parse(lastFilterState);
      
      // Load the saved state
      filterState = { ...savedState };
      
      // Ensure checkedFilters exists
      if (!filterState.checkedFilters) {
        filterState.checkedFilters = {};
      }
      
      // Ensure checkedTypes exists and has default values
      if (!filterState.checkedTypes) {
        filterState.checkedTypes = ['Project', 'Bedrijf'];
      }
      
      // Update current filter for URL
      currentFilter = {
        ...currentFilter,
        checkedTypes: filterState.checkedTypes,
        checkedFilters: filterState.checkedFilters,
        searchTerm: filterState.searchTerm || ''
      };
      
      // Update UI after filters are loaded
      setTimeout(() => {
        updateCheckboxesFromFilterState();
        
        // Update search input
        if (filterState.searchTerm) {
          const searchInput = document.getElementById('mapSearch');
          if (searchInput) {
            searchInput.value = filterState.searchTerm;
          }
        }
        
        // Update URL and apply filters
        updateURL();
        applyFilters();
      }, 500);
      
    } catch (error) {
      console.error('Error loading last filter state:', error);
    }
  }
}

// Store filter state when leaving map page
function storeCurrentFilterState() {
  if (isMapPage && !isInfoPage && !isOverPage) {
    // Update filter state with current search term
    const searchInput = document.getElementById('mapSearch');
    if (searchInput) {
      filterState.searchTerm = searchInput.value.trim();
    }
    
    // Only store if there are actual filters applied
    if (filterState.checkedFilters && Object.keys(filterState.checkedFilters).length > 0 || 
        filterState.searchTerm || 
        (filterState.checkedTypes && filterState.checkedTypes.length < 2)) {
      localStorage.setItem('hbm_last_filter_state', JSON.stringify(filterState));
    }
  }
}

// Store page visit time when leaving map page
function storePageVisit() {
  if (!isMapPage || isInfoPage || isOverPage) {
    localStorage.setItem('hbm_last_page_visit', Date.now().toString());
  }
}

// Add event listeners for page navigation
window.addEventListener('beforeunload', storeCurrentFilterState);
document.addEventListener('DOMContentLoaded', storePageVisit);

// Export for global access
window.getCurrentLocation = getCurrentLocation;
window.showDetails = showDetails;
window.openContactForm = openContactForm;
window.trackEvent = trackEvent;
window.updateFilterState = updateFilterState;
window.toggleAdvancedFilters = toggleAdvancedFilters;
window.synchronizeTabWithTypes = synchronizeTabWithTypes;
window.activateTab = activateTab;
window.exportCurrentResults = exportCurrentResults;
window.showAllResults = showAllResults;
window.closeAllOverlays = closeAllOverlays;

// Function to update checkboxes based on filter state
function updateCheckboxesFromFilterState() {
  // HBMTypes
  document.querySelectorAll('input[name="HBMType"]').forEach(cb => {
    cb.checked = filterState.checkedTypes.includes(cb.value);
  });

  // Other filters
  const filterSections = ['ProjectType', 'OrganizationType', 'OrganizationField', 'HBMTopic', 'HBMCharacteristics', 'HBMSector', 'Municipality'];
  filterSections.forEach(section => {
    document.querySelectorAll(`input[name="${section}"]`).forEach(cb => {
      cb.checked = filterState.checkedFilters[section]?.includes(cb.value) || false;
    });
  });
}

function loadSavedFilters() {
  const savedFilters = JSON.parse(localStorage.getItem('hbm_saved_filters') || '{}');
  if (Object.keys(savedFilters).length === 0) {
    alert('Geen opgeslagen filters gevonden.');
    return;
  }

  // Create popup HTML
  const popupHTML = `
    <div class="saved-filters-popup">
      <div class="saved-filters-popup-content">
        <div class="saved-filters-header">
          <h3>Opgeslagen Filters</h3>
          <button class="close-popup-btn" onclick="closeSavedFiltersPopup()">
            <img src="icons/close.svg" alt="Sluiten" class="close-icon" />
          </button>
        </div>
        <div class="saved-filters-list">
          ${Object.entries(savedFilters).map(([name, filter]) => `
            <div class="saved-filter-item">
              <div class="saved-filter-info">
                <div class="saved-filter-name">${name}</div>
                <div class="saved-filter-date">${new Date(filter.timestamp).toLocaleDateString('nl-NL')}</div>
              </div>
              <div class="saved-filter-actions">
                <button class="load-filter-btn" onclick="loadSavedFilter('${name}'); closeSavedFiltersPopup();">Laden</button>
                <button class="delete-filter-btn" onclick="deleteSavedFilterFromPopup('${name}');">Verwijderen</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  // Add popup to body
  document.body.insertAdjacentHTML('beforeend', popupHTML);

  // Close dropdown
  const filterDropdown = document.querySelector('.filter-dropdown');
  if (filterDropdown) {
    filterDropdown.classList.remove('open');
  }
}

function closeSavedFiltersPopup() {
  const popup = document.querySelector('.saved-filters-popup');
  if (popup) {
    popup.remove();
  }
}

function deleteSavedFilterFromPopup(filterName) {
  if (!confirm(`Weet je zeker dat je filter "${filterName}" wilt verwijderen?`)) return;

  const savedFilters = JSON.parse(localStorage.getItem('hbm_saved_filters') || '{}');
  delete savedFilters[filterName];
  localStorage.setItem('hbm_saved_filters', JSON.stringify(savedFilters));

  // Refresh popup content
  closeSavedFiltersPopup();
  loadSavedFilters();

  // Update dropdown
  updateSavedFiltersDropdown();

  alert(`Filter "${filterName}" verwijderd!`);
}

function getCurrentFilteredData() {
  if (!window.data || !Array.isArray(window.data)) {
    return [];
  }

  // Get filter values from form
  const checkedTypes = Array.from(document.querySelectorAll('input[name="HBMType"]:checked')).map(cb => cb.value);
  const checkedProjectTypes = Array.from(document.querySelectorAll('input[name="ProjectType"]:checked')).map(cb => cb.value);
  const checkedOrganizationTypes = Array.from(document.querySelectorAll('input[name="OrganizationType"]:checked')).map(cb => cb.value);
  const checkedOrganizationFields = Array.from(document.querySelectorAll('input[name="OrganizationField"]:checked')).map(cb => cb.value);
  const checkedHBMTopics = Array.from(document.querySelectorAll('input[name="HBMTopic"]:checked')).map(cb => cb.value);
  const checkedHBMCharacteristics = Array.from(document.querySelectorAll('input[name="HBMCharacteristics"]:checked')).map(cb => cb.value);
  const checkedHBMSectors = Array.from(document.querySelectorAll('input[name="HBMSector"]:checked')).map(cb => cb.value);
  const checkedMunicipalities = Array.from(document.querySelectorAll('input[name="Municipality"]:checked')).map(cb => cb.value);

  return window.data.filter(item => {
    // Type filter (Project/Bedrijf checkboxes)
    if (checkedTypes.length > 0 && !checkedTypes.includes(item.HBMType)) {
      return false;
    }

    // ProjectType filter
    if (checkedProjectTypes.length > 0) {
      const itemProjectTypes = Array.isArray(item.ProjectType) ? item.ProjectType : [item.ProjectType].filter(Boolean);
      if (!checkedProjectTypes.some(type => itemProjectTypes.includes(type))) {
        return false;
      }
    }

    // OrganizationType filter
    if (checkedOrganizationTypes.length > 0) {
      const itemOrganizationTypes = Array.isArray(item.OrganizationType) ? item.OrganizationType : [item.OrganizationType].filter(Boolean);
      if (!checkedOrganizationTypes.some(type => itemOrganizationTypes.includes(type))) {
        return false;
      }
    }

    // OrganizationField filter
    if (checkedOrganizationFields.length > 0) {
      const itemFields = Array.isArray(item.OrganizationField) ? item.OrganizationField : [item.OrganizationField].filter(Boolean);
      if (!checkedOrganizationFields.some(field => itemFields.includes(field))) {
        return false;
      }
    }

    // HBMTopic filter - use filterState if form values are empty
    const activeHBMTopics = checkedHBMTopics.length > 0 ? checkedHBMTopics : (filterState.checkedFilters['HBMTopic'] || []);
    if (activeHBMTopics.length > 0) {
      const itemTopics = Array.isArray(item.HBMTopic) ? item.HBMTopic : [item.HBMTopic].filter(Boolean);
      if (!activeHBMTopics.some(topic => itemTopics.includes(topic))) {
        return false;
      }
    }

    // HBMCharacteristics filter - use filterState if form values are empty
    const activeHBMCharacteristics = checkedHBMCharacteristics.length > 0 ? checkedHBMCharacteristics : (filterState.checkedFilters['HBMCharacteristics'] || []);
    if (activeHBMCharacteristics.length > 0) {
      const itemCharacteristics = Array.isArray(item.HBMCharacteristics) ? item.HBMCharacteristics : [item.HBMCharacteristics].filter(Boolean);
      if (!activeHBMCharacteristics.some(characteristic => itemCharacteristics.includes(characteristic))) {
        return false;
      }
    }

    // HBMSector filter - use filterState if form values are empty
    const activeHBMSectors = checkedHBMSectors.length > 0 ? checkedHBMSectors : (filterState.checkedFilters['HBMSector'] || []);
    if (activeHBMSectors.length > 0) {
      const itemSectors = Array.isArray(item.HBMSector) ? item.HBMSector : [item.HBMSector].filter(Boolean);
      if (!activeHBMSectors.some(sector => itemSectors.includes(sector))) {
        return false;
      }
    }

    // Municipality filter - use filterState if form values are empty
    const activeMunicipalities = checkedMunicipalities.length > 0 ? checkedMunicipalities : (filterState.checkedFilters['Municipality'] || []);
    if (activeMunicipalities.length > 0 && !activeMunicipalities.includes(item.Municipality)) {
      return false;
    }

    // Search filter
    if (currentFilter.searchTerm) {
      const searchLower = currentFilter.searchTerm.toLowerCase();
      const nameMatch = item.Name && item.Name.toLowerCase().includes(searchLower);
      const descMatch = item.Description && item.Description.toLowerCase().includes(searchLower);
      if (!nameMatch && !descMatch) {
        return false;
      }
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