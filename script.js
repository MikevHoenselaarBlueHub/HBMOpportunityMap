
// Global variables
let currentLanguage = 'nl';
let translations = {};
let map, markers = [];
let pIcon, bIcon;
let hoverLabel;
let municipalityLayer;

// Load translations
async function loadTranslations() {
  try {
    const response = await fetch(`translations/${currentLanguage}.json`);
    translations = await response.json();
  } catch (error) {
    console.error('Error loading translations:', error);
    // Fallback to Dutch if translation file fails to load
    if (currentLanguage !== 'nl') {
      currentLanguage = 'nl';
      await loadTranslations();
    }
  }
}

function t(key) {
  return translations[key] || key;
}

async function setLanguage(lang) {
  currentLanguage = lang;
  await loadTranslations();
  updateUI();
}

function updateUI() {
  // Update button texts
  const selectAllBtn = document.getElementById('selectAll');
  const selectNoneBtn = document.getElementById('selectNone');
  const applyBtn = document.getElementById('applyFilters');
  const filterBtn = document.getElementById('filterBtn');
  
  if (selectAllBtn) selectAllBtn.textContent = t('selectAll');
  if (selectNoneBtn) selectNoneBtn.textContent = t('selectNone');
  if (applyBtn) applyBtn.textContent = t('apply');
  if (filterBtn) filterBtn.textContent = t('filters');
  
  // Update all elements with data-i18n attributes
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    if (translations[key]) {
      element.textContent = t(key);
    }
  });
  
  // Update page title
  document.title = t('opportunityMap');
  
  // Update no selection message if it exists
  const noSelectionMessage = document.getElementById('noSelectionMessage');
  if (noSelectionMessage) {
    noSelectionMessage.innerHTML = `<p style="color: #666; font-style: italic; margin-top: 1rem;">${t('noSelection')}</p>`;
  }
  
  // Update HBMType checkboxes labels
  const projectCheckbox = document.querySelector('input[name="HBMType"][value="Project"]');
  const companyCheckbox = document.querySelector('input[name="HBMType"][value="Bedrijf"]');
  
  if (projectCheckbox && projectCheckbox.nextElementSibling) {
    projectCheckbox.nextElementSibling.textContent = t('projects');
  }
  if (companyCheckbox && companyCheckbox.nextElementSibling) {
    companyCheckbox.nextElementSibling.textContent = t('companies');
  }
}

// Create hover label for markers
function createHoverLabel() {
  if (!hoverLabel) {
    hoverLabel = document.createElement('div');
    hoverLabel.className = 'marker-hover-label';
    hoverLabel.style.cssText = `
      position: absolute;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 14px;
      font-weight: bold;
      pointer-events: none;
      z-index: 10000;
      white-space: nowrap;
      max-width: 200px;
      text-overflow: ellipsis;
      overflow: hidden;
      display: none;
    `;
    document.body.appendChild(hoverLabel);
  }
}

function showHoverLabel(e, text) {
  if (!hoverLabel) createHoverLabel();
  
  hoverLabel.textContent = text;
  hoverLabel.style.display = 'block';
  
  // Position the label near the cursor but keep it in viewport
  const rect = document.documentElement.getBoundingClientRect();
  const labelRect = hoverLabel.getBoundingClientRect();
  
  let x = e.clientX + 10;
  let y = e.clientY - 30;
  
  // Adjust if label would go outside viewport
  if (x + labelRect.width > window.innerWidth) {
    x = e.clientX - labelRect.width - 10;
  }
  if (y < 0) {
    y = e.clientY + 10;
  }
  
  hoverLabel.style.left = x + 'px';
  hoverLabel.style.top = y + 'px';
}

function hideHoverLabel() {
  if (hoverLabel) {
    hoverLabel.style.display = 'none';
  }
}

// Contact form functions
function showContactForm(location) {
  const formOverlay = document.getElementById('formOverlay');
  formOverlay.innerHTML = `
    <div class="contact-form-container">
      <div class="contact-form-header">
        <h2>${t('contactForm')}</h2>
        <a href="#" id="closeContactForm" class="close-btn">
          <img src="icons/close.svg" alt="${t('close')}" class="close-icon"/>
        </a>
      </div>
      <div class="contact-form-content">
        <p><strong>${t('interestedIn')}:</strong> ${location.Name}</p>
        <form id="contactForm" action="https://formspree.io/f/YOUR_FORM_ID" method="POST">
          <input type="hidden" name="subject" value="${t('interestedIn')}: ${location.Name}">
          <input type="hidden" name="interested_in" value="${location.Name}">
          
          <div class="form-group">
            <label for="firstName">${t('firstName')} *</label>
            <input type="text" id="firstName" name="firstName" required>
          </div>
          
          <div class="form-group">
            <label for="lastName">${t('lastName')} *</label>
            <input type="text" id="lastName" name="lastName" required>
          </div>
          
          <div class="form-group">
            <label for="email">${t('email')} *</label>
            <input type="email" id="email" name="email" required>
          </div>
          
          <div class="form-group">
            <label for="company">${t('company')}</label>
            <input type="text" id="company" name="company">
          </div>
          
          <div class="form-group">
            <label for="phone">${t('phone')}</label>
            <input type="tel" id="phone" name="phone">
          </div>
          
          <div class="form-group">
            <label for="message">${t('message')} *</label>
            <textarea id="message" name="message" rows="5" required></textarea>
          </div>
          
          <div class="form-actions">
            <button type="button" class="btn-secondary" onclick="closeContactForm()">${t('cancel')}</button>
            <button type="submit" class="btn-primary">${t('send')}</button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  formOverlay.classList.add('open');
  
  // Add event listeners
  document.getElementById('closeContactForm').onclick = closeContactForm;
  document.getElementById('contactForm').onsubmit = handleContactSubmit;
}

function closeContactForm() {
  document.getElementById('formOverlay').classList.remove('open');
}

function handleContactSubmit(e) {
  e.preventDefault();
  
  // Get form data
  const formData = new FormData(e.target);
  
  // You can implement your own email sending logic here
  // For now, we'll use Formspree (replace YOUR_FORM_ID with actual ID)
  fetch('https://formspree.io/f/YOUR_FORM_ID', {
    method: 'POST',
    body: formData,
    headers: {
      'Accept': 'application/json'
    }
  }).then(response => {
    if (response.ok) {
      alert('Bericht succesvol verzonden!');
      closeContactForm();
    } else {
      alert('Er is een fout opgetreden. Probeer het opnieuw.');
    }
  }).catch(error => {
    console.error('Error:', error);
    alert('Er is een fout opgetreden. Probeer het opnieuw.');
  });
}

// Hamburger en overlays
if (document.getElementById('hamburger')) {
  document.getElementById('hamburger').onclick = () => document.getElementById('menuOverlay').classList.add('open');
}
if (document.getElementById('closeMenu')) {
  document.getElementById('closeMenu').onclick = () => document.getElementById('menuOverlay').classList.remove('open');
}
if (document.getElementById('filterBtn')) {
  document.getElementById('filterBtn').onclick = () => document.getElementById('filterOverlay').classList.add('open');
}
if (document.getElementById('closeFilters')) {
  document.getElementById('closeFilters').onclick = () => document.getElementById('filterOverlay').classList.remove('open');
}
if (document.getElementById('applyFilters')) {
  document.getElementById('applyFilters').onclick = () => {
    updateMap();
    document.getElementById('filterOverlay').classList.remove('open');
  };
}
if (document.getElementById('selectAll')) {
  document.getElementById('selectAll').onclick = () => {
    document.querySelectorAll('#filtersForm input[type="checkbox"]').forEach(cb => cb.checked = true);
    updateFilterState();
  };
}
if (document.getElementById('selectNone')) {
  document.getElementById('selectNone').onclick = () => {
    document.querySelectorAll('#filtersForm input[type="checkbox"]').forEach(cb => cb.checked = false);
    updateFilterState();
  };
}
if (document.getElementById('closeDetail')) {
  document.getElementById('closeDetail').onclick = () => {
    document.getElementById('detailPanel').classList.remove('open');
  };
}

// Search functionality
if (document.getElementById('mapSearch')) {
  const searchInput = document.getElementById('mapSearch');
  const searchBtn = document.getElementById('searchBtn');
  
  function performSearch() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    if (!searchTerm) {
      updateMap();
      return;
    }
    
    // Filter data based on search term
    const searchResults = window.data.filter(loc => {
      return loc.Name.toLowerCase().includes(searchTerm) ||
             (loc.Description && loc.Description.toLowerCase().includes(searchTerm)) ||
             (Array.isArray(loc.HBMTopic) ? loc.HBMTopic.some(topic => topic.toLowerCase().includes(searchTerm)) : loc.HBMTopic.toLowerCase().includes(searchTerm)) ||
             (Array.isArray(loc.OrganizationType) ? loc.OrganizationType.some(type => type.toLowerCase().includes(searchTerm)) : loc.OrganizationType.toLowerCase().includes(searchTerm));
    });
    
    // Update map with search results
    displaySearchResults(searchResults);
  }
  
  searchBtn.onclick = performSearch;
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      performSearch();
    }
  });
  
  // Clear search when input is empty
  searchInput.addEventListener('input', (e) => {
    if (!e.target.value.trim()) {
      updateMap();
    }
  });
}

function displaySearchResults(results) {
  if (!map) return;
  
  // Clear existing markers
  markers.forEach(m => map.removeLayer(m));
  markers = [];
  
  if (results.length === 0) {
    alert(t('noSearchResults') || 'Geen zoekresultaten gevonden');
    return;
  }
  
  // Add markers for search results
  const bounds = [];
  results.forEach(loc => {
    const markerOptions = {};
    const isProject = (Array.isArray(loc.HBMType) ? loc.HBMType.includes('Project') : loc.HBMType === 'Project');
    
    if (isProject && loc.ProjectImage) {
      const photoIcon = L.divIcon({
        className: 'photo-marker',
        html: `<div class="photo-marker-container">
                 <img src="${loc.ProjectImage}" alt="${loc.Name}" class="photo-marker-image" onerror="this.parentNode.style.display='none'">
                 <div class="photo-marker-overlay"></div>
               </div>`,
        iconSize: [50, 50],
        iconAnchor: [25, 50],
        popupAnchor: [0, -50]
      });
      markerOptions.icon = photoIcon;
    } else if (pIcon && bIcon) {
      markerOptions.icon = isProject ? pIcon : bIcon;
    }
    
    const marker = L.marker([loc.Latitude, loc.Longitude], markerOptions).addTo(map);
    
    marker.on('click', () => {
      showLocationDetails(loc);
    });
    
    marker.on('mouseover', (e) => {
      const domEvent = e.originalEvent;
      showHoverLabel(domEvent, loc.Name);
    });
    
    marker.on('mouseout', () => {
      hideHoverLabel();
    });
    
    marker.on('mousemove', (e) => {
      const domEvent = e.originalEvent;
      showHoverLabel(domEvent, loc.Name);
    });
    
    markers.push(marker);
    bounds.push([loc.Latitude, loc.Longitude]);
  });
  
  // Adjust map view to show search results
  if (bounds.length > 0) {
    if (bounds.length === 1) {
      map.setView(bounds[0], 14);
    } else {
      map.fitBounds(bounds, {
        padding: [20, 20],
        maxZoom: 15
      });
    }
  }
}

// Initialize map only if we're on the map page
if (document.getElementById('map')) {
  // Function to initialize everything when Leaflet is ready
  async function initializeApp() {
    if (typeof L !== 'undefined') {
      // Load translations first
      await loadTranslations();
      
      // Initialize icons
      pIcon = L.icon({ 
        iconUrl: 'icons/marker-project.svg', 
        iconSize: [30, 40],
        iconAnchor: [15, 40],
        popupAnchor: [0, -40]
      });
      bIcon = L.icon({ 
        iconUrl: 'icons/marker-company.svg', 
        iconSize: [30, 40],
        iconAnchor: [15, 40],
        popupAnchor: [0, -40]
      });
      
      // Create hover label
      createHoverLabel();
      
      // Data laden
      fetch('opportunities.json')
        .then(res => res.json())
        .then(data => {
          window.data = data;
          createFilterCheckboxes();
          updateMap();
          updateUI();
        })
        .catch(error => {
          console.error('Error loading data:', error);
          const mapElement = document.getElementById('map');
          mapElement.innerHTML = `<div style="padding: 2rem; text-align: center; color: #666;">${t('dataLoadError')}</div>`;
        });
    } else {
      // Retry after a short delay
      setTimeout(initializeApp, 100);
    }
  }

  // Wait for DOM and then initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
  } else {
    initializeApp();
  }
} else {
  // For non-map pages, still load translations
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
      await loadTranslations();
      updateUI();
    });
  } else {
    loadTranslations().then(updateUI);
  }
}

function createFilterCheckboxes() {
  const keys = ['ProjectType','OrganizationType','OrganizationField','HBMTopic','HBMCharacteristics','HBMSector'];
  keys.forEach(key => {
    const allValues = [];
    window.data.forEach(d => {
      const value = d[key];
      if (Array.isArray(value)) {
        allValues.push(...value);
      } else if (value) {
        allValues.push(value);
      }
    });
    const values = [...new Set(allValues)];
    const container = document.getElementById(key);
    if (container) {
      container.innerHTML = '';
      values.forEach(val => {
        const id = `${key}-${val}`;
        container.innerHTML += `<label><input type="checkbox" name="${key}" value="${val}" checked onchange="updateFilterState()"/> ${val}</label> `;
      });
    }
  });
  
  // Add change listeners to HBMType checkboxes
  document.querySelectorAll('input[name="HBMType"]').forEach(cb => {
    cb.addEventListener('change', updateFilterState);
  });
  
  updateFilterState();
}

function loadMunicipalityBoundaries() {
  // Define municipality boundaries for the main cities in the region
  const municipalities = [
    {
      name: "Maastricht",
      bounds: [[50.82, 5.62], [50.88, 5.72], [50.90, 5.75], [50.85, 5.78], [50.82, 5.75], [50.80, 5.68], [50.82, 5.62]]
    },
    {
      name: "Aachen",
      bounds: [[50.72, 6.04], [50.78, 6.04], [50.82, 6.09], [50.81, 6.14], [50.77, 6.15], [50.73, 6.12], [50.72, 6.08], [50.72, 6.04]]
    },
    {
      name: "Venlo",
      bounds: [[51.32, 6.10], [51.38, 6.12], [51.42, 6.18], [51.40, 6.22], [51.36, 6.24], [51.32, 6.21], [51.30, 6.15], [51.32, 6.10]]
    },
    {
      name: "Roermond",
      bounds: [[51.14, 5.95], [51.20, 5.96], [51.24, 6.00], [51.25, 6.04], [51.22, 6.06], [51.18, 6.04], [51.15, 6.00], [51.14, 5.95]]
    },
    {
      name: "Krefeld",
      bounds: [[51.30, 6.52], [51.36, 6.53], [51.38, 6.58], [51.37, 6.62], [51.33, 6.62], [51.29, 6.58], [51.28, 6.54], [51.30, 6.52]]
    },
    {
      name: "Mönchengladbach",
      bounds: [[51.15, 6.38], [51.21, 6.39], [51.25, 6.44], [51.24, 6.48], [51.20, 6.49], [51.16, 6.47], [51.14, 6.42], [51.15, 6.38]]
    },
    {
      name: "Heinsberg",
      bounds: [[51.04, 6.05], [51.08, 6.06], [51.11, 6.12], [51.10, 6.16], [51.06, 6.16], [51.03, 6.13], [51.02, 6.08], [51.04, 6.05]]
    }
  ];
  
  municipalities.forEach(municipality => {
    const polygon = L.polygon(municipality.bounds, {
      color: 'rgb(38, 123, 41)',
      weight: 2,
      opacity: 0.8,
      fillColor: 'rgb(38, 123, 41)',
      fillOpacity: 0.1
    }).addTo(municipalityLayer);
    
    // Add municipality name label
    const center = polygon.getBounds().getCenter();
    L.marker(center, {
      icon: L.divIcon({
        className: 'municipality-label',
        html: `<div style="background: rgba(255,255,255,0.9); padding: 2px 6px; border-radius: 3px; font-size: 12px; font-weight: bold; color: rgb(38, 123, 41); border: 1px solid rgb(38, 123, 41);">${municipality.name}</div>`,
        iconSize: [100, 20],
        iconAnchor: [50, 10]
      })
    }).addTo(municipalityLayer);
  });
}

function updateFilterState() {
  const checkedFilters = document.querySelectorAll('#filtersForm input[type="checkbox"]:checked');
  const applyButton = document.getElementById('applyFilters');
  const noSelectionMessage = document.getElementById('noSelectionMessage');
  
  if (checkedFilters.length === 0) {
    if (applyButton) applyButton.style.display = 'none';
    if (!noSelectionMessage) {
      const message = document.createElement('div');
      message.id = 'noSelectionMessage';
      message.innerHTML = `<p style="color: #666; font-style: italic; margin-top: 1rem;">${t('noSelection')}</p>`;
      applyButton.parentNode.insertBefore(message, applyButton);
    }
  } else {
    if (applyButton) applyButton.style.display = 'block';
    if (noSelectionMessage) noSelectionMessage.remove();
  }
}

function showLocationDetails(location) {
  const detailPanel = document.getElementById('detailPanel');
  const locationName = location.Name;
  const isProject = (Array.isArray(location.HBMType) ? location.HBMType.includes('Project') : location.HBMType === 'Project');
  
  // Determine which image to show
  let imageHtml = '';
  if (isProject && location.ProjectImage) {
    imageHtml = `<div class="detail-image">
                   <img src="${location.ProjectImage}" alt="${locationName}" onerror="this.parentNode.style.display='none'">
                 </div>`;
  } else if (!isProject && location.Logo) {
    imageHtml = `<div class="detail-logo">
                   <img src="${location.Logo}" alt="${locationName} logo" onerror="this.parentNode.style.display='none'">
                 </div>`;
  }
  
  detailPanel.innerHTML = `
    <a href="#" id="closeDetail" class="close-btn">
      <img src="icons/close.svg" alt="${t('close')}" class="close-icon"/>
    </a>
    <div class="detail-content">
      ${imageHtml}
      <div class="detail-header">
        <h2>${locationName}</h2>
        <div class="detail-type-badge ${isProject ? 'project' : 'company'}">
          ${Array.isArray(location.HBMType) ? location.HBMType.join(', ') : location.HBMType}
        </div>
      </div>
      
      <div class="detail-info">
        <div class="detail-row">
          <span class="detail-label">${t('projectType')}:</span>
          <span class="detail-value">${Array.isArray(location.ProjectType) ? location.ProjectType.join(', ') : location.ProjectType}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">${t('organizationType')}:</span>
          <span class="detail-value">${Array.isArray(location.OrganizationType) ? location.OrganizationType.join(', ') : location.OrganizationType}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">${t('organizationField')}:</span>
          <span class="detail-value">${Array.isArray(location.OrganizationField) ? location.OrganizationField.join(', ') : location.OrganizationField}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">${t('hbmTopic')}:</span>
          <span class="detail-value">${Array.isArray(location.HBMTopic) ? location.HBMTopic.join(', ') : location.HBMTopic}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">${t('hbmCharacteristics')}:</span>
          <span class="detail-value">${Array.isArray(location.HBMCharacteristics) ? location.HBMCharacteristics.join(', ') : location.HBMCharacteristics}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">${t('hbmSector')}:</span>
          <span class="detail-value">${Array.isArray(location.HBMSector) ? location.HBMSector.join(', ') : location.HBMSector}</span>
        </div>
      </div>
      
      <div class="detail-description">
        <h3>${t('description')}</h3>
        <p>${location.Description}</p>
      </div>
      
      <div class="detail-actions">
        <button class="btn-primary" onclick="showContactForm(${JSON.stringify(location).replace(/"/g, '&quot;')})">${t('contact')}</button>
      </div>
    </div>
  `;

  // Re-attach close event listener
  detailPanel.querySelector('#closeDetail').onclick = () => {
    detailPanel.classList.remove('open');
  };

  detailPanel.classList.add('open');
}

function updateMap() {
  if (!window.data || !document.getElementById('map')) return;

  // Initialize map if needed
  if (!map) {
    map = L.map('map').setView([51.2, 6.1], 9);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    
    // Add municipality layer
    municipalityLayer = L.layerGroup();
    
    // Add layer control
    const baseLayers = {
      "OpenStreetMap": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png')
    };
    
    const overlayLayers = {
      "Gemeenten": municipalityLayer
    };
    
    L.control.layers(baseLayers, overlayLayers, {
      position: 'topright',
      collapsed: false
    }).addTo(map);
    
    // Load municipality boundaries
    loadMunicipalityBoundaries();
  }

  // Clear existing markers
  markers.forEach(m => map.removeLayer(m));
  markers = [];
  
  // Get all checked filters
  const filters = {};
  document.querySelectorAll('#filtersForm input[type="checkbox"]:checked').forEach(cb => {
    const name = cb.name;
    if (!filters[name]) filters[name] = [];
    filters[name].push(cb.value);
  });

  // Filter data based on selected filters
  const filtered = window.data.filter(d => {
    return Object.keys(filters).every(k => {
      if (!filters[k] || filters[k].length === 0) return true;
      const dataValue = d[k];
      if (Array.isArray(dataValue)) {
        return dataValue.some(val => filters[k].includes(val));
      } else {
        return filters[k].includes(dataValue);
      }
    });
  });

  // Add markers for filtered data with clustering
  const bounds = [];
  const markerGroup = L.featureGroup();
  
  filtered.forEach(loc => {
    const markerOptions = {};
    const isProject = (Array.isArray(loc.HBMType) ? loc.HBMType.includes('Project') : loc.HBMType === 'Project');
    
    // Check if project has an image for custom marker
    if (isProject && loc.ProjectImage) {
      // Create custom photo marker
      const photoIcon = L.divIcon({
        className: 'photo-marker',
        html: `<div class="photo-marker-container">
                 <img src="${loc.ProjectImage}" alt="${loc.Name}" class="photo-marker-image" onerror="this.parentNode.style.display='none'">
                 <div class="photo-marker-overlay"></div>
               </div>`,
        iconSize: [50, 50],
        iconAnchor: [25, 50],
        popupAnchor: [0, -50]
      });
      markerOptions.icon = photoIcon;
    } else if (pIcon && bIcon) {
      markerOptions.icon = isProject ? pIcon : bIcon;
    }
    
    const marker = L.marker([loc.Latitude, loc.Longitude], markerOptions);
    
    // Add location data to marker
    marker.locationData = loc;
    
    // Add click event
    marker.on('click', () => {
      showLocationDetails(loc);
    });
    
    // Add hover events for label
    marker.on('mouseover', (e) => {
      const domEvent = e.originalEvent;
      showHoverLabel(domEvent, loc.Name);
    });
    
    marker.on('mouseout', () => {
      hideHoverLabel();
    });
    
    marker.on('mousemove', (e) => {
      const domEvent = e.originalEvent;
      showHoverLabel(domEvent, loc.Name);
    });
    
    markerGroup.addLayer(marker);
    markers.push(marker);
    bounds.push([loc.Latitude, loc.Longitude]);
  });
  
  // Add marker group to map
  map.addLayer(markerGroup);

  // Adjust map view to show all markers
  if (bounds.length > 0) {
    if (bounds.length === 1) {
      map.setView(bounds[0], 12);
    } else {
      map.fitBounds(bounds, {
        padding: [20, 20],
        maxZoom: 15
      });
    }
  } else {
    map.setView([51.2, 6.1], 9);
  }
}
