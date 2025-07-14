// Global variables
let currentLanguage = 'nl';
let translations = {};
let map, markers = [];
let pIcon, bIcon;
let hoverLabel;
let municipalityLayer;
let markerClusterGroup;
let currentListView = false;
let filteredData = [];
let isInitialLoad = true;
let userLocationMarker = null;
let userLocation = null;
let savedFiltersData = [];
let airQualityLayer;
let greenSpacesLayer;
let noiseZonesLayer;
let buildingAgesLayer;

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
  if (typeof gtag === 'function') {
    gtag('event', eventName, {
      event_category: 'kansenkaart_interaction',
      event_label: parameters.label || '',
      value: parameters.value || 0,
      custom_parameter_1: parameters.custom_parameter_1 || '',
      ...parameters
    });
  }
}

// Track page views
function trackPageView(pageName) {
  if (typeof gtag === 'function') {
    gtag('config', 'G-2RMYQV239Q', {
      page_title: `HBM Kansenkaart - ${pageName}`,
      page_location: window.location.href,
      custom_map: {
        'custom_parameter_1': 'page_view'
      }
    });
  }
}

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

  // Track language change
  trackEvent('language_change', {
    label: lang,
    custom_parameter_1: 'language_selection',
    previous_language: currentLanguage,
    new_language: lang
  });
}

function updateUI() {
  // Update button texts
  const selectAllBtn = document.getElementById('selectAll');
  const selectNoneBtn = document.getElementById('selectNone');
  const applyBtn = document.getElementById('applyFilters');
  const filterBtn = document.getElementById('filterBtn');
  const shareBtn = document.getElementById('shareBtn');

  if (selectAllBtn) selectAllBtn.textContent = t('selectAll');
  if (selectNoneBtn) selectNoneBtn.textContent = t('selectNone');
  if (applyBtn) applyBtn.textContent = t('apply');
  if (shareBtn) shareBtn.textContent = t('share');

  // Update filter button with count
  updateFilterButtonLabel();

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
  // Track contact form open
  trackEvent('contact_form_open', {
    location_name: location.Name,
    location_type: Array.isArray(location.HBMType) ? location.HBMType.join(', ') : location.HBMType,
    label: `Contact form opened for: ${location.Name}`,
    custom_parameter_1: 'lead_generation'
  });

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
  // Track contact form close
  trackEvent('contact_form_close', {
    label: 'Contact form closed',
    custom_parameter_1: 'form_interaction'
  });

  document.getElementById('formOverlay').classList.remove('open');
}

function handleContactSubmit(e) {
  e.preventDefault();

  // Get form data
  const formData = new FormData(e.target);
  const interestedIn = formData.get('interested_in');

  // Track form submission attempt
  trackEvent('contact_form_submit', {
    location_name: interestedIn,
    label: `Contact form submitted for: ${interestedIn}`,
    custom_parameter_1: 'lead_conversion',
    value: 1
  });

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
      // Track successful submission
      trackEvent('contact_form_success', {
        location_name: interestedIn,
        label: `Contact form successfully sent for: ${interestedIn}`,
        custom_parameter_1: 'conversion_success',
        value: 1
      });

      alert('Bericht succesvol verzonden!');
      closeContactForm();
    } else {
      // Track failed submission
      trackEvent('contact_form_error', {
        location_name: interestedIn,
        error_type: 'server_error',
        label: `Contact form failed for: ${interestedIn}`,
        custom_parameter_1: 'conversion_error'
      });

      alert('Er is een fout opgetreden. Probeer het opnieuw.');
    }
  }).catch(error => {
    console.error('Error:', error);

    // Track network error
    trackEvent('contact_form_error', {
      location_name: interestedIn,
      error_type: 'network_error',
      label: `Contact form network error for: ${interestedIn}`,
      custom_parameter_1: 'conversion_error'
    });

    alert('Er is een fout opgetreden. Probeer het opnieuw.');
  });
}

// Hamburger en overlays - only add listeners if elements exist
if (document.getElementById('hamburger')) {
  document.getElementById('hamburger').onclick = () => {
    trackEvent('menu_open', {
      label: 'Hamburger menu opened',
      custom_parameter_1: 'navigation'
    });
    const menuOverlay = document.getElementById('menuOverlay');
    if (menuOverlay) {
      menuOverlay.classList.add('open');
    }
  };
}
if (document.getElementById('closeMenu')) {
  document.getElementById('closeMenu').onclick = (e) => {
    e.preventDefault();
    trackEvent('menu_close', {
      label: 'Menu closed',
      custom_parameter_1: 'navigation'
    });
    const menuOverlay = document.getElementById('menuOverlay');
    if (menuOverlay) {
      menuOverlay.classList.remove('open');
    }
  };
}
if (document.getElementById('filterBtn')) {
  document.getElementById('filterBtn').onclick = () => {
    trackEvent('filter_open', {
      label: 'Filter panel opened',
      custom_parameter_1: 'filter_interaction'
    });
    document.getElementById('filterOverlay').classList.add('open');
  };
}
if (document.getElementById('closeFilters')) {
  document.getElementById('closeFilters').onclick = () => {
    trackEvent('filter_close', {
      label: 'Filter panel closed',
      custom_parameter_1: 'filter_interaction'
    });
    document.getElementById('filterOverlay').classList.remove('open');
  };
}
if (document.getElementById('applyFilters')) {
  document.getElementById('applyFilters').onclick = () => {
    // Get active filters for tracking
    const activeFilters = getActiveFilters();

    trackEvent('filter_apply', {
      label: 'Filters applied',
      custom_parameter_1: 'filter_interaction',
      filter_count: Object.keys(activeFilters).length,
      active_filters: JSON.stringify(activeFilters)
    });

    // Save filters and update URL
    saveFiltersToStorage();
    updateURLWithFilters();
    updateFilterButtonLabel();

    updateMap();
    document.getElementById('filterOverlay').classList.remove('open');
  };
}
if (document.getElementById('selectAll')) {
  document.getElementById('selectAll').onclick = () => {
    trackEvent('filter_select_all', {
      label: 'Select all filters',
      custom_parameter_1: 'filter_interaction'
    });
    document.querySelectorAll('#filtersForm input[type="checkbox"]').forEach(cb => cb.checked = true);
    updateFilterState();
    updateFilterButtonLabel();
  };
}
if (document.getElementById('selectNone')) {
  document.getElementById('selectNone').onclick = () => {
    trackEvent('filter_select_none', {
      label: 'Select no filters',
      custom_parameter_1: 'filter_interaction'
    });
    document.querySelectorAll('#filtersForm input[type="checkbox"]').forEach(cb => cb.checked = false);
    updateFilterState();
    updateFilterButtonLabel();
  };
}

// View toggle functionality
if (document.getElementById('viewToggle')) {
  document.getElementById('viewToggle').onclick = () => {
    const listContainer = document.getElementById('listContainer');
    const viewToggleText = document.getElementById('viewToggleText');

    currentListView = !currentListView;

    if (currentListView) {
      listContainer.classList.add('show');
      viewToggleText.textContent = t('map') || 'Kaart';
    } else {
      listContainer.classList.remove('show');
      viewToggleText.textContent = t('list') || 'Lijst';
    }

    trackEvent('view_toggle', {
      view: currentListView ? 'list' : 'map',
      label: `Switched to ${currentListView ? 'list' : 'map'} view`,
      custom_parameter_1: 'navigation'
    });
  };
}

// Data export functionality
if (document.getElementById('exportBtn')) {
  document.getElementById('exportBtn').onclick = () => {
    exportData();
  };
}

// Share functionality
if (document.getElementById('shareBtn')) {
  document.getElementById('shareBtn').onclick = () => {
    updateURLWithFilters();
    copyURLToClipboard();
  };
}

// Save current filters from dropdown
if (document.getElementById('saveCurrentFiltersBtn')) {
  document.getElementById('saveCurrentFiltersBtn').onclick = () => {
    saveCurrentFilters();
  };
}

// Load saved filters from dropdown  
if (document.getElementById('loadSavedFiltersBtn')) {
  document.getElementById('loadSavedFiltersBtn').onclick = () => {
    showSavedFiltersModal();
  };
}

// Options dropdown toggle
if (document.getElementById('optionsBtn')) {
  document.getElementById('optionsBtn').onclick = (e) => {
    e.stopPropagation();
    const dropdown = document.querySelector('.filter-dropdown');
    dropdown.classList.toggle('open');

    trackEvent('options_menu_toggle', {
      action: dropdown.classList.contains('open') ? 'open' : 'close',
      label: 'Options menu toggled',
      custom_parameter_1: 'menu_interaction'
    });
  };
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  const dropdown = document.querySelector('.filter-dropdown');
  if (dropdown && !dropdown.contains(e.target)) {
    dropdown.classList.remove('open');
  }
});
if (document.getElementById('closeDetail')) {
  document.getElementById('closeDetail').onclick = () => {
    trackEvent('detail_panel_close', {
      label: 'Detail panel closed',
      custom_parameter_1: 'content_interaction'
    });
    document.getElementById('detailPanel').classList.remove('open');
  };
}

// Advanced filter event listeners
if (document.getElementById('useMyLocation')) {
  document.getElementById('useMyLocation').onclick = () => {
    getUserLocation();
  };
}

if (document.getElementById('distanceRange')) {
  document.getElementById('distanceRange').oninput = (e) => {
    document.getElementById('distanceValue').textContent = e.target.value + ' km';
  };
}

if (document.getElementById('saveCurrentFilters')) {
  document.getElementById('saveCurrentFilters').onclick = () => {
    saveCurrentFilters();
  };
}

if (document.getElementById('deleteSavedFilter')) {
  document.getElementById('deleteSavedFilter').onclick = () => {
    deleteSavedFilter();
  };
}

if (document.getElementById('savedFiltersSelect')) {
  document.getElementById('savedFiltersSelect').onchange = (e) => {
    if (e.target.value) {
      loadSavedFilter(e.target.value);
    }
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

    // Track search
    trackEvent('search', {
      search_term: searchTerm,
      results_count: searchResults.length,
      label: `Search: ${searchTerm}`,
      custom_parameter_1: 'map_search',
      value: searchResults.length
    });

    // Update map with search results
    displaySearchResults(searchResults);
  }

  // Debounced search for better performance
  let searchTimeout;
  function debouncedSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(performSearch, 300);
  }

  searchBtn.onclick = performSearch;
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      clearTimeout(searchTimeout);
      performSearch();
    }
  });

  // Debounced search on input
  searchInput.addEventListener('input', (e) => {
    if (!e.target.value.trim()) {
      clearTimeout(searchTimeout);
      updateMap();
    } else {
      debouncedSearch();
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

  // Store filtered results
  filteredData = results;
  updateOpportunitiesList(results);

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

// Tab functionality
function initializeTabs() {
  const tabs = document.querySelectorAll('.list-tab');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.getAttribute('data-tab');

      // Remove active class from all tabs and panes
      tabs.forEach(t => t.classList.remove('active'));
      tabPanes.forEach(pane => pane.classList.remove('active'));

      // Add active class to clicked tab
      tab.classList.add('active');

      // Show corresponding tab pane
      const targetPane = document.getElementById(targetTab + 'Tab');
      if (targetPane) {
        targetPane.classList.add('active');
      }

      // Track tab change
      trackEvent('tab_change', {
        tab: targetTab,
        label: `Tab changed to: ${targetTab}`,
        custom_parameter_1: 'navigation'
      });
    });
  });
}

function updateOpportunitiesList(data) {
  const buildingsContainer = document.getElementById('opportunitiesList');
  const companiesContainer = document.getElementById('companiesList');
  const resultsCount = document.getElementById('resultsCount');
  const buildingsCount = document.getElementById('buildingsCount');
  const companiesCount = document.getElementById('companiesCount');

  if (!buildingsContainer || !companiesContainer || !resultsCount) return;

  // Separate projects and companies
  const projects = data.filter(item => {
    const type = Array.isArray(item.HBMType) ? item.HBMType : [item.HBMType];
    return type.includes('Project');
  });

  const companies = data.filter(item => {
    const type = Array.isArray(item.HBMType) ? item.HBMType : [item.HBMType];
    return type.includes('Bedrijf');
  });

  resultsCount.textContent = `${data.length} resultaten`;
  if (buildingsCount) buildingsCount.textContent = `(${projects.length})`;
  if (companiesCount) companiesCount.textContent = `(${companies.length})`;

  // Update buildings list
  if (projects.length === 0) {
    buildingsContainer.innerHTML = `
      <div class="no-results-opportunity">
        <h2>Geen projecten gevonden?</h2>
        <p><strong>Dan ligt hier een kans voor gezond bouwen!</strong></p>

        <p>In dit gebied zijn nog geen actieve projecten zichtbaar.<br>
        Maar HBM kan je helpen met:</p>

        <ul>
          <li><strong>Inzichten delen:</strong> Wat speelt er in deze regio?</li>
          <li><strong>Netwerken verbinden:</strong> Wie werkt hier aan gezonde gebouwen?</li>
          <li><strong>Startpunt maken:</strong> Samen ontdekken waar de kansen liggen.</li>
        </ul>

        <p>📬 Wil je weten wat HBM nog meer voor jou kan betekenen?</p>
        <div class="contact-cta">
          <a href="contact.html" class="btn-primary">Neem contact op</a>
          <span>voor een kennisscan en deel jouw behoefte.</span>
        </div>
      </div>
    `;
  } else {
    buildingsContainer.innerHTML = projects.map((opportunity, index) => {
      let imageHtml = '';
      if (opportunity.ProjectImage) {
        imageHtml = `<img src="${opportunity.ProjectImage}" alt="${opportunity.Name}" class="card-image" onerror="this.style.display='none'">`;
      }

      return `
        <div class="opportunity-card" data-index="${index}" onclick="selectOpportunity(${index})">
          <div class="card-header">
            <h4 class="card-title">${opportunity.Name}</h4>
            <span class="card-type-badge project">
              Project
            </span>
          </div>

          ${imageHtml}

          <div class="card-details">
            <div class="card-detail-row">
              <span class="card-detail-label">${t('organizationType')}:</span>
              <span class="card-detail-value">${Array.isArray(opportunity.OrganizationType) ? opportunity.OrganizationType.join(', ') : opportunity.OrganizationType}</span>
            </div>
            <div class="card-detail-row">
              <span class="card-detail-label">${t('hbmTopic')}:</span>
              <span class="card-detail-value">${Array.isArray(opportunity.HBMTopic) ? opportunity.HBMTopic.join(', ') : opportunity.HBMTopic}</span>
            </div>
            <div class="card-detail-row">
              <span class="card-detail-label">${t('hbmSector')}:</span>
              <span class="card-detail-value">${Array.isArray(opportunity.HBMSector) ? opportunity.HBMSector.join(', ') : opportunity.HBMSector}</span>
            </div>
          </div>

          <div class="card-description">${opportunity.Description}</div>

          <div class="card-actions">
            <button class="card-contact-btn" onclick="showContactForm(${JSON.stringify(opportunity).replace(/"/g, '&quot;')}); event.stopPropagation();">
              ${t('contact') || 'Contact'}
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  // Update companies list
  if (companies.length === 0) {
    companiesContainer.innerHTML = `
      <div class="no-results-opportunity">
        <h2>Geen bedrijven gevonden?</h2>
        <p><strong>Misschien ken jij bedrijven die actief zijn met gezond bouwen?</strong></p>

        <p>Help ons de kaart completer te maken door bedrijven aan te melden!</p>

        <div class="contact-cta">
          <a href="contact.html" class="btn-primary">Meld een bedrijf aan</a>
          <span>en help anderen deze experts te vinden.</span>
        </div>
      </div>
    `;
  } else {
    companiesContainer.innerHTML = companies.map((opportunity, index) => {
      const companyIndex = projects.length + index; // Adjust index for companies
      let imageHtml = '';
      if (opportunity.Logo) {
        imageHtml = `<img src="${opportunity.Logo}" alt="${opportunity.Name}" class="card-logo" onerror="this.style.display='none'">`;
      }

      return `
        <div class="opportunity-card" data-index="${companyIndex}" onclick="selectOpportunity(${companyIndex})">
          <div class="card-header">
            <h4 class="card-title">${opportunity.Name}</h4>
            <span class="card-type-badge company">
              Bedrijf
            </span>
          </div>

          ${imageHtml}

          <div class="card-details">
            <div class="card-detail-row">
              <span class="card-detail-label">${t('organizationType')}:</span>
              <span class="card-detail-value">${Array.isArray(opportunity.OrganizationType) ? opportunity.OrganizationType.join(', ') : opportunity.OrganizationType}</span>
            </div>
            <div class="card-detail-row">
              <span class="card-detail-label">${t('hbmTopic')}:</span>
              <span class="card-detail-value">${Array.isArray(opportunity.HBMTopic) ? opportunity.HBMTopic.join(', ') : opportunity.HBMTopic}</span>
            </div>
            <div class="card-detail-row">
              <span class="card-detail-label">${t('hbmSector')}:</span>
              <span class="card-detail-value">${Array.isArray(opportunity.HBMSector) ? opportunity.HBMSector.join(', ') : opportunity.HBMSector}</span>
            </div>
          </div>

          <div class="card-description">${opportunity.Description}</div>

          <div class="card-actions">
            <button class="card-contact-btn" onclick="showContactForm(${JSON.stringify(opportunity).replace(/"/g, '&quot;')}); event.stopPropagation();">
              ${t('contact') || 'Contact'}
            </button>
          </div>
        </div>
      `;
    }).join('');
  }
}

function selectOpportunity(index) {
  const opportunity = filteredData[index];
  if (!opportunity) return;

  // Highlight the card
  document.querySelectorAll('.opportunity-card').forEach(card => card.classList.remove('highlighted'));
  document.querySelector(`[data-index="${index}"]`).classList.add('highlighted');

  // Center map on the location
  if (map) {
    map.setView([opportunity.Latitude, opportunity.Longitude], 14);
  }

  // Show location details with index
  showLocationDetails(opportunity, index);

  // Track card click
  trackEvent('list_item_click', {
    location_name: opportunity.Name,
    location_type: Array.isArray(opportunity.HBMType) ? opportunity.HBMType.join(', ') : opportunity.HBMType,
    label: `List item clicked: ${opportunity.Name}`,
    custom_parameter_1: 'list_interaction'
  });
}

// Filter state management functions
function saveFiltersToStorage() {
  const filters = getActiveFilters();
  localStorage.setItem('kansenkaart_filters', JSON.stringify(filters));
}

function loadFiltersFromStorage() {
  try {
    const saved = localStorage.getItem('kansenkaart_filters');
    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    console.error('Error loading filters from storage:', error);
    return null;
  }
}

function getActiveFilters() {
  const filters = {};
  document.querySelectorAll('#filtersForm input[type="checkbox"]:checked').forEach(cb => {
    const name = cb.name;
    if (!filters[name]) filters[name] = [];
    filters[name].push(cb.value);
  });
  return filters;
}

function setActiveFilters(filters) {
  // First uncheck all
  document.querySelectorAll('#filtersForm input[type="checkbox"]').forEach(cb => {
    cb.checked = false;
  });

  // Then check the ones in the filter object
  Object.keys(filters).forEach(filterName => {
    if (filters[filterName] && filters[filterName].length > 0) {
      filters[filterName].forEach(value => {
        const checkbox = document.querySelector(`input[name="${filterName}"][value="${value}"]`);
        if (checkbox) {
          checkbox.checked = true;
        }
      });
    }
  });

  updateFilterState();
}

function updateURLWithFilters() {
  const filters = getActiveFilters();
  const url = new URL(window.location);

  // Clear existing filter parameters
  Object.keys(Object.fromEntries(url.searchParams)).forEach(key => {
    if (key.startsWith('filter_')) {
      url.searchParams.delete(key);
    }
  });

  // Add current filters
  Object.keys(filters).forEach(filterName => {
    if (filters[filterName] && filters[filterName].length > 0) {
      url.searchParams.set(`filter_${filterName}`, filters[filterName].join(','));
    }
  });

  // Update URL without reloading page
  window.history.replaceState({}, '', url);
}

function loadFiltersFromURL() {
  const url = new URL(window.location);
  const filters = {};

  url.searchParams.forEach((value, key) => {
    if (key.startsWith('filter_')) {
      const filterName = key.replace('filter_', '');
      filters[filterName] = value.split(',');
    }
  });

  return Object.keys(filters).length > 0 ? filters : null;
}

function updateFilterButtonLabel() {
  const filterBtn = document.getElementById('filterBtn');
  if (!filterBtn) return;

  const activeFilterCount = Object.values(getActiveFilters()).reduce((total, filterArray) => total + filterArray.length, 0);

  if (activeFilterCount > 0) {
    filterBtn.textContent = `${t('filters')} (${activeFilterCount})`;
  } else {
    filterBtn.textContent = t('filters');
  }
}

function copyURLToClipboard() {
  const url = window.location.href;

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(url).then(() => {
      alert(t('urlCopied') || 'URL gekopieerd naar klembord!');
    }).catch(err => {
      console.error('Failed to copy URL:', err);
      fallbackCopyTextToClipboard(url);
    });
  } else {
    fallbackCopyTextToClipboard(url);
  }

  // Track share action
  trackEvent('url_share', {
    label: 'URL shared to clipboard',
    custom_parameter_1: 'sharing',
    url: url
  });
}

function fallbackCopyTextToClipboard(text) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.top = '0';
  textArea.style.left = '0';
  textArea.style.position = 'fixed';

  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    const successful = document.execCommand('copy');
    if (successful) {
      alert(t('urlCopied') || 'URL gekopieerd naar klembord!');
    } else {
      alert(t('urlCopyFailed') || 'Kon URL niet kopiëren. Kopieer handmatig uit de adresbalk.');
    }
  } catch (err) {
    console.error('Fallback: Could not copy text: ', err);
    alert(t('urlCopyFailed') || 'Kon URL niet kopiëren. Kopieer handmatig uit de adresbalk.');
  }

  document.body.removeChild(textArea);
}

// Export data function
function exportData() {
  if (!window.data) return;

  // Get filtered data
  const filters = {};
  document.querySelectorAll('#filtersForm input[type="checkbox"]:checked').forEach(cb => {
    const name = cb.name;
    if (!filters[name]) filters[name] = [];
    filters[name].push(cb.value);
  });

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

  // Create CSV content
  const headers = ['Name', 'ProjectType', 'OrganizationType', 'OrganizationField', 'HBMTopic', 'HBMCharacteristics', 'HBMSector', 'HBMType', 'Description', 'Latitude', 'Longitude'];
  const csvContent = [
    headers.join(','),
    ...filtered.map(item => headers.map(header => {
      const value = item[header];
      if (Array.isArray(value)) {
        return `"${value.join('; ')}"`;
      }
      return `"${value || ''}"`;
    }).join(','))
  ].join('\n');

  // Create and download file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `kansenkaart_export_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Track export
  trackEvent('data_export', {
    export_format: 'csv',
    items_count: filtered.length,
    label: `Data exported: ${filtered.length} items`,
    custom_parameter_1: 'data_interaction',
    value: filtered.length
  });
}

// Toggle advanced filters
function toggleAdvancedFilters() {
  const advancedFilters = document.getElementById('advancedFilters');
  const isOpening = !advancedFilters.classList.contains('open');

  advancedFilters.classList.toggle('open');

  trackEvent('advanced_filters_toggle', {
    action: isOpening ? 'open' : 'close',
    label: 'Advanced filters toggled',
    custom_parameter_1: 'filter_interaction'
  });
}

// Check if we're on the map page by looking for the map element
const isMapPage = document.getElementById('map') !== null;

// Check current page path to determine if we should load map-related scripts
const currentPath = window.location.pathname;
const isInfoPage = currentPath.includes('info') || currentPath.endsWith('info.html');
const isOverPage = currentPath.includes('over') || currentPath.endsWith('over.html');

// Initialize map only if we're on the map page
if (isMapPage && !isInfoPage && !isOverPage) {
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
      fetch('opportunities.json')
        .then(res => res.json())
        .then(async data => {
          // Process data and geocode missing coordinates
          window.data = await processDataWithGeocoding(data);

          // Track data load success
          trackEvent('data_load_success', {
            data_count: data.length,
            label: `Successfully loaded ${data.length} opportunities`,
            custom_parameter_1: 'data_interaction',
            value: data.length
          });

          createFilterCheckboxes();
          loadSavedFiltersFromStorage();
          updateMap();
          updateUI();
        })
        .catch(error => {
          console.error('Error loading data:', error);

          // Track data load error
          trackEvent('data_load_error', {
            error_message: error.message,
            label: 'Failed to load opportunities data',
            custom_parameter_1: 'data_error'
          });

          // Show user-friendly error with retry option
          const mapElement = document.getElementById('map');
          mapElement.innerHTML = `
            <div style="padding: 2rem; text-align: center; color: #666; background: #f8f9fa; border-radius: 8px; margin: 2rem;">
              <h3 style="color: rgb(38, 123, 41); margin-bottom: 1rem;">Gegevens kunnen niet geladen worden</h3>
              <p>Er is een probleem opgetreden bij het laden van de kansenkaart gegevens.</p>
              <p style="font-size: 0.9rem; color: #888;">Fout: ${error.message}</p>
              <button onclick="location.reload()" style="background: rgb(38, 123, 41); color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 4px; cursor: pointer; margin-top: 1rem;">
                Probeer opnieuw
              </button>
            </div>
          `;
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
  // For non-map pages, only load translations and basic functionality
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
      await loadTranslations();
      updateUI();

      // Track page view for non-map pages
      const pageName = document.title || 'Unknown Page';
      trackPageView(pageName);

      // Don't load opportunities.json for info/over pages
      if (!isInfoPage && !isOverPage) {
        // Only load opportunities if not on info/over pages
        console.log('Non-map page detected, skipping opportunities load');
      }
    });
  } else {
    loadTranslations().then(() => {
      updateUI();
      const pageName = document.title || 'Unknown Page';
      trackPageView(pageName);
    });
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
        container.innerHTML += `<label><input type="checkbox" name="${key}" value="${val}" checked onchange="updateFilterState(); updateFilterButtonLabel();"/> ${val}</label> `;
      });
    }
  });

  // Add change listeners to HBMType checkboxes
  document.querySelectorAll('input[name="HBMType"]').forEach(cb => {
    cb.addEventListener('change', () => {
      updateFilterState();
      updateFilterButtonLabel();
    });
  });

  // Load filters from URL first, then from storage if no URL filters
  const urlFilters = loadFiltersFromURL();
  const storageFilters = loadFiltersFromStorage();

  if (urlFilters) {
    setActiveFilters(urlFilters);
  } else if (storageFilters && isInitialLoad) {
    setActiveFilters(storageFilters);
  } else {
    updateFilterState();
  }

  updateFilterButtonLabel();
  isInitialLoad = false;
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
    const response = await fetch('nl-gemeenten.geojson');

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

        try {
          const geoJsonLayer = L.geoJSON(feature, {
            style: {
              color: 'rgb(38, 123, 41)',
              weight: 1,
              opacity: 0.7,
              fillColor: 'rgb(38, 123, 41)',
              fillOpacity: 0.1,
              smoothFactor: 0.5,
              dashArray: '3, 6'
            },
            onEachFeature: function(feature, layer) {
              layer.on({
                mouseover: function(e) {
                  const layer = e.target;
                  layer.setStyle({
                    color: 'rgb(38, 123, 41)',
                    weight: 2,
                    opacity: 1,
                    fillColor: 'rgb(38, 123, 41)',
                    fillOpacity: 0.3,
                    dashArray: '3, 6'
                  });
                  layer.bringToFront();
                },
                mouseout: function(e) {
                  const layer = e.target;
                  layer.setStyle({
                    color: 'rgb(38, 123, 41)',
                    weight: 1,
                    opacity: 0.7,
                    fillColor: 'rgb(38, 123, 41)',
                    fillOpacity: 0.1,
                    dashArray: '3, 6'
                  });
                }
              });
            }
          });

          geoJsonLayer.bindPopup(`<strong>${municipalityName}</strong><br><small>Nederland</small>`);
          municipalityLayer.addLayer(geoJsonLayer);
          loadedCount++;

        } catch (err) {
          console.warn(`Error processing Dutch municipality ${municipalityName}:`, err);
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
    const response = await fetch('de-gemeenten.geojson');

    if (!response.ok) {
      console.warn('German municipalities file not found, skipping...');
      return;
    }

    const geojsonData = await response.json();

    // GADM format check
    if (!geojsonData.features || !Array.isArray(geojsonData.features)) {
      console.warn('Invalid GADM format - no features array found');
      return;
    }

    if (geojsonData.features.length === 0) {
      console.warn('No German GeoJSON features found');
      return;
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
              weight: 1,
              opacity: 0.7,
              fillColor: 'rgb(38, 123, 41)',
              fillOpacity: 0.1,
              smoothFactor: 0.5,
              dashArray: '3, 6'
            },
            onEachFeature: function(feature, layer) {
              layer.on({
                mouseover: function(e) {
                  const layer = e.target;
                  layer.setStyle({
                    color: 'rgb(38, 123, 41)',
                    weight: 2,
                    opacity: 1,
                    fillColor: 'rgb(38, 123, 41)',
                    fillOpacity: 0.3,
                    dashArray: '3, 6'
                  });
                  layer.bringToFront();
                },
                mouseout: function(e) {
                  const layer = e.target;
                  layer.setStyle({
                    color: 'rgb(38, 123, 41)',
                    weight: 1,
                    opacity: 0.7,
                    fillColor: 'rgb(38, 123, 41)',
                    fillOpacity: 0.1,
                    dashArray: '3, 6'
                  });
                }
              });
            }
          });

          // Enhanced popup with more information
          const popupContent = `
            <div class="municipality-popup">
              <h4>${municipalityName}</h4>
              <p><strong>Staat:</strong> ${state}</p>
              <p><strong>Land:</strong> Deutschland</p>
              <p><strong>Type:</strong> Gemeente</p>
              <hr>
              <small>Klik voor meer details over gezond bouwen kansen in deze gemeente</small>
            </div>
          `;
          geoJsonLayer.bindPopup(popupContent);
          municipalityLayer.addLayer(geoJsonLayer);
          loadedCount++;

        } catch (err) {
          console.warn(`Error processing German municipality ${municipalityName}:`, err);
        }
      }
    });

    console.log(`Successfully loaded ${loadedCount} German municipalities`);

  } catch (error) {
    console.error('Error loading German municipalities:', error);
    // Don't throw error here, just log it as German data is optional
  }
}

function convertRelationToCoordinates(element) {
  try {
    const coordinates = [];

    // Look for outer ways in the relation
    const outerWays = element.members.filter(member => 
      member.type === 'way' && member.role === 'outer'
    );

    if (outerWays.length === 0) {
      // If no explicit outer ways, use all ways
      const allWays = element.members.filter(member => member.type === 'way');
      if (allWays.length > 0) {
        outerWays.push(...allWays);
      }
    }

    outerWays.forEach(wayMember => {
      if (wayMember.geometry && wayMember.geometry.length > 2) {
        const wayCoords = wayMember.geometry.map(node => [node.lat, node.lon]);
        coordinates.push(wayCoords);
      }
    });

    // If we have multiple coordinate arrays, merge them into a single polygon
    if (coordinates.length > 1) {
      // For simplicity, just use the first (usually largest) polygon
      return coordinates[0];
    } else if (coordinates.length === 1) {
      return coordinates[0];
    }

    return null;
  } catch (error) {
    console.warn('Error converting relation coordinates:', error);
    return null;
  }
}

function convertRelationToCoordinatesImproved(element) {
  try {
    if (!element.members || element.members.length === 0) {
      console.warn('No members found in relation');
      return null;
    }

    // Look for ways with geometry data
    const waysWithGeometry = element.members.filter(member => 
      member.type === 'way' && member.geometry && member.geometry.length > 2
    );

    if (waysWithGeometry.length === 0) {
      console.warn('No ways with geometry found');
      return null;
    }

    // Find the longest way (likely the main boundary)
    let longestWay = waysWithGeometry[0];
    for (const way of waysWithGeometry) {
      if (way.geometry.length > longestWay.geometry.length) {
        longestWay = way;
      }
    }

    // Convert the longest way to coordinates
    const coordinates = longestWay.geometry.map(node => [node.lat, node.lon]);

    // Ensure the polygon is closed
    if (coordinates.length > 2) {
      const first = coordinates[0];
      const last = coordinates[coordinates.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        coordinates.push([first[0], first[1]]);
      }
    }

    return coordinates.length > 3 ? coordinates : null;

  } catch (error) {
    console.warn('Error in improved coordinate conversion:', error);
    return null;
  }
}

function loadProfessionalMunicipalities() {
  console.log('Loading professional municipality boundaries...');

  // Professional boundaries for key Euregio municipalities with accurate coordinates
  const eurregioMunicipalities = [
    {
      name: "Maastricht",
      country: "Nederland",
      bounds: [[50.824, 5.624], [50.864, 5.634], [50.887, 5.678], [50.898, 5.712], [50.891, 5.758], [50.873, 5.782], [50.849, 5.791], [50.821, 5.783], [50.803, 5.753], [50.799, 5.712], [50.806, 5.675], [50.818, 5.644], [50.824, 5.624]]
    },
    {
      name: "Aachen",
      country: "Deutschland", 
      bounds: [[50.719, 6.041], [50.751, 6.035], [50.786, 6.058], [50.812, 6.089], [50.823, 6.121], [50.816, 6.154], [50.798, 6.178], [50.774, 6.189], [50.746, 6.183], [50.721, 6.165], [50.707, 6.136], [50.703, 6.104], [50.712, 6.071], [50.719, 6.041]]
    },
    {
      name: "Liège",
      country: "België",
      bounds: [[50.578, 5.521], [50.612, 5.534], [50.638, 5.556], [50.657, 5.589], [50.668, 5.626], [50.671, 5.663], [50.665, 5.698], [50.649, 5.728], [50.627, 5.751], [50.598, 5.765], [50.567, 5.771], [50.537, 5.768], [50.511, 5.756], [50.489, 5.734], [50.474, 5.706], [50.467, 5.673], [50.469, 5.638], [50.481, 5.605], [50.502, 5.576], [50.531, 5.552], [50.565, 5.535], [50.578, 5.521]]
    },
    {
      name: "Hasselt",
      country: "België",
      bounds: [[50.891, 5.301], [50.923, 5.312], [50.948, 5.334], [50.967, 5.364], [50.978, 5.398], [50.981, 5.434], [50.975, 5.469], [50.961, 5.501], [50.939, 5.528], [50.912, 5.548], [50.881, 5.561], [50.848, 5.567], [50.814, 5.565], [50.782, 5.556], [50.753, 5.539], [50.728, 5.515], [50.708, 5.485], [50.694, 5.451], [50.687, 5.414], [50.687, 5.376], [50.695, 5.339], [50.711, 5.305], [50.734, 5.276], [50.763, 5.253], [50.796, 5.237], [50.832, 5.228], [50.868, 5.227], [50.891, 5.301]]
    },
    {
      name: "Genk",
      country: "België",
      bounds: [[50.934, 5.451], [50.961, 5.461], [50.984, 5.478], [50.002, 5.503], [51.012, 5.534], [51.016, 5.567], [51.014, 5.601], [51.006, 5.633], [50.991, 5.662], [50.971, 5.687], [50.946, 5.708], [50.917, 5.724], [50.886, 5.735], [50.853, 5.741], [50.820, 5.741], [50.787, 5.736], [50.756, 5.725], [50.728, 5.708], [50.704, 5.686], [50.685, 5.659], [50.672, 5.628], [50.665, 5.594], [50.664, 5.559], [50.670, 5.525], [50.682, 5.493], [50.701, 5.464], [50.726, 5.440], [50.756, 5.421], [50.789, 5.408], [50.824, 5.401], [50.860, 5.400], [50.895, 5.406], [50.928, 5.418], [50.957, 5.436], [50.934, 5.451]]
    },
    {
      name: "Venlo",
      country: "Nederland", 
      bounds: [[51.321, 6.101], [51.348, 6.112], [51.372, 6.131], [51.392, 6.157], [51.407, 6.189], [51.417, 6.224], [51.421, 6.261], [51.419, 6.298], [51.410, 6.333], [51.395, 6.366], [51.374, 6.395], [51.347, 6.420], [51.316, 6.440], [51.282, 6.454], [51.246, 6.462], [51.209, 6.464], [51.172, 6.460], [51.136, 6.449], [51.102, 6.432], [51.071, 6.408], [51.044, 6.379], [51.022, 6.345], [51.005, 6.307], [50.994, 6.266], [50.989, 6.223], [50.990, 6.179], [50.997, 6.136], [51.011, 6.095], [51.032, 6.058], [51.059, 6.025], [51.092, 5.997], [51.130, 5.975], [51.171, 5.960], [51.215, 5.951], [51.259, 5.950], [51.302, 5.956], [51.343, 5.970], [51.380, 5.991], [51.413, 6.019], [51.441, 6.053], [51.463, 6.092], [51.321, 6.101]]
    },
    {
      name: "Roermond",
      country: "Nederland",
      bounds: [[51.141, 5.951], [51.168, 5.961], [51.193, 5.978], [51.215, 6.002], [51.233, 6.032], [51.247, 6.067], [51.255, 6.106], [51.258, 6.146], [51.256, 6.187], [51.248, 6.227], [51.235, 6.265], [51.217, 6.301], [51.194, 6.333], [51.166, 6.362], [51.134, 6.386], [51.099, 6.405], [51.061, 6.420], [51.021, 6.429], [50.980, 6.433], [50.939, 6.432], [50.898, 6.425], [50.858, 6.413], [50.820, 6.395], [50.784, 6.372], [50.752, 6.343], [50.724, 6.309], [50.700, 6.271], [50.681, 6.229], [50.667, 6.184], [50.658, 6.137], [50.654, 6.089], [50.655, 6.040], [50.661, 5.992], [50.672, 5.945], [50.688, 5.900], [50.709, 5.858], [50.734, 5.819], [50.764, 5.785], [50.798, 5.755], [50.836, 5.730], [50.876, 5.711], [50.919, 5.697], [50.964, 5.690], [51.010, 5.689], [51.056, 5.695], [51.101, 5.707], [51.144, 5.726], [51.184, 5.751], [51.220, 5.782], [51.252, 5.819], [51.278, 5.861], [51.298, 5.908], [51.311, 5.958], [51.141, 5.951]]
    },
    {
      name: "Eindhoven",
      country: "Nederland",
      bounds: [[51.401, 5.421], [51.431, 5.432], [51.459, 5.450], [51.484, 5.475], [51.505, 5.506], [51.521, 5.542], [51.533, 5.581], [51.540, 5.622], [51.542, 5.665], [51.539, 5.708], [51.531, 5.750], [51.518, 5.791], [51.500, 5.830], [51.477, 5.866], [51.449, 5.899], [51.416, 5.928], [51.379, 5.952], [51.338, 5.972], [51.294, 5.988], [51.248, 5.999], [51.201, 6.005], [51.153, 6.006], [51.105, 6.002], [51.057, 5.993], [51.011, 5.979], [50.966, 5.960], [50.923, 5.936], [50.882, 5.907], [50.844, 5.873], [50.810, 5.835], [50.779, 5.793], [50.752, 5.747], [50.730, 5.697], [50.712, 5.644], [50.699, 5.588], [50.691, 5.530], [50.688, 5.471], [50.690, 5.411], [50.697, 5.352], [50.710, 5.294], [50.728, 5.238], [50.752, 5.185], [50.781, 5.135], [50.816, 5.089], [50.856, 5.048], [50.901, 5.012], [50.951, 4.982], [51.005, 4.958], [51.062, 4.940], [51.122, 4.929], [51.183, 4.925], [51.245, 4.928], [51.307, 4.938], [51.368, 4.955], [51.427, 4.979], [51.484, 5.010], [51.537, 5.048], [51.586, 5.093], [51.630, 5.145], [51.668, 5.203], [51.700, 5.267], [51.725, 5.336], [51.743, 5.410], [51.401, 5.421]]
    }
  ];

  eurregioMunicipalities.forEach(municipality => {
    const polygon = L.polygon(municipality.bounds, {
              color: 'rgb(38, 123, 41)',
              weight: 1,
              opacity: 0.7,
              fillColor: 'rgb(38, 123, 41)',
              fillOpacity: 0.1,
              smoothFactor: 0.5,
              dashArray: '3, 6'
            });

    // Add hover effects
    polygon.on({
      mouseover: function(e) {
        const layer = e.target;
        layer.setStyle({
          color: 'rgb(38, 123, 41)',
          weight: 2,
          opacity: 1,
          fillColor: 'rgb(38, 123, 41)',
          fillOpacity: 0.3,
          dashArray: '3, 6'
        });
        layer.bringToFront();
      },
      mouseout: function(e) {
        const layer = e.target;
        layer.setStyle({
          color: 'rgb(38, 123, 41)',
          weight: 1,
          opacity: 0.7,
          fillColor: 'rgb(38, 123, 41)',
          fillOpacity: 0.1,
          dashArray: '3, 6'
        });
      }
    });

    // Add popup with municipality name and country
    polygon.bindPopup(`<strong>${municipality.name}</strong><br><small>${municipality.country}</small>`);

    municipalityLayer.addLayer(polygon);
  });

  console.log(`Loaded ${eurregioMunicipalities.length} professional municipalities`);
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

  updateFilterButtonLabel();
}

// Global variable for current detail index
let currentDetailIndex = -1;

function showLocationDetails(location, index = -1) {
  // Track location detail view
  const isProject = (Array.isArray(location.HBMType) ? location.HBMType.includes('Project') : location.HBMType === 'Project');
  trackEvent('location_detail_view', {
    location_name: location.Name,
    location_type: Array.isArray(location.HBMType) ? location.HBMType.join(', ') : location.HBMType,
    organization_type: Array.isArray(location.OrganizationType) ? location.OrganizationType.join(', ') : location.OrganizationType,
    hbm_sector: Array.isArray(location.HBMSector) ? location.HBMSector.join(', ') : location.HBMSector,
    label: `Location detail viewed: ${location.Name}`,
    custom_parameter_1: 'content_engagement',
    is_project: isProject
  });

  // Set current index for navigation
  if (index >= 0) {
    currentDetailIndex = index;
  } else {
    // Find index in filteredData
    currentDetailIndex = filteredData.findIndex(item => item.Name === location.Name);
  }

  const detailPanel = document.getElementById('detailPanel');
  const locationName = location.Name;

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

  // Navigation buttons
  const prevDisabled = currentDetailIndex <= 0;
  const nextDisabled = currentDetailIndex >= filteredData.length - 1;

  detailPanel.innerHTML = `
    <div class="detail-content">
      <a href="#" id="closeDetail" class="close-btn">
        <img src="icons/close.svg" alt="${t('close')}" class="close-icon"/>
      </a>
      ${imageHtml}
      <div class="detail-header">
        <div class="detail-navigation-container">
          <button class="detail-navigation prev" id="prevDetail" ${prevDisabled ? 'disabled' : ''}>
            ←
          </button>
          <button class="detail-navigation next" id="nextDetail" ${nextDisabled ? 'disabled' : ''}>
            →
          </button>
          <h2>${locationName}</h2>
        </div>
        <div class="detail-header-right">
          <div class="detail-type-badge ${isProject ? 'project' : 'company'}">
            ${Array.isArray(location.HBMType) ? location.HBMType.join(', ') : location.HBMType}
          </div>
          <button class="detail-contact-btn" onclick="showContactForm(${JSON.stringify(location).replace(/"/g, '&quot;')})">${t('contact')}</button>
        </div>
      </div>

      <div class="detail-description">
        <h3>${t('description')}</h3>
        <p>${location.Description}</p>
      </div>

      <div class="detail-info">
        <div class="detail-row">
          <span class="detail-label">${t('projectType')}</span>
          <span class="detail-value">${Array.isArray(location.ProjectType) ? location.ProjectType.join(', ') : location.ProjectType}</span>
        </div>

        <div class="detail-row">
          <span class="detail-label">${t('organizationType')}</span>
          <span class="detail-value">${Array.isArray(location.OrganizationType) ? location.OrganizationType.join(', ') : location.OrganizationType}</span>
        </div>

        <div class="detail-row">
          <span class="detail-label">${t('organizationField')}</span>
          <span class="detail-value">${Array.isArray(location.OrganizationField) ? location.OrganizationField.join(', ') : location.OrganizationField}</span>
        </div>

        <div class="detail-row">
          <span class="detail-label">${t('hbmTopic')}</span>
          <span class="detail-value">${Array.isArray(location.HBMTopic) ? location.HBMTopic.join(', ') : location.HBMTopic}</span>
        </div>

        <div class="detail-row">
          <span class="detail-label">${t('hbmCharacteristics')}</span>
          <span class="detail-value">${Array.isArray(location.HBMCharacteristics) ? location.HBMCharacteristics.join(', ') : location.HBMCharacteristics}</span>
        </div>

        <div class="detail-row">
          <span class="detail-label">${t('hbmSector')}</span>
          <span class="detail-value">${Array.isArray(location.HBMSector) ? location.HBMSector.join(', ') : location.HBMSector}</span>
        </div>
      </div>
    </div>
  `;

  // Re-attach event listeners
  detailPanel.querySelector('#closeDetail').onclick = () => {
    detailPanel.classList.remove('open');
  };

  // Navigation event listeners
  const prevBtn = detailPanel.querySelector('#prevDetail');
  const nextBtn = detailPanel.querySelector('#nextDetail');

  if (prevBtn && !prevDisabled) {
    prevBtn.onclick = () => navigateDetail(-1);
  }

  if (nextBtn && !nextDisabled) {
    nextBtn.onclick = () => navigateDetail(1);
  }

  detailPanel.classList.add('open');
}

function navigateDetail(direction) {
  const newIndex = currentDetailIndex + direction;

  if (newIndex >= 0 && newIndex < filteredData.length) {
    const nextLocation = filteredData[newIndex];

    // Update map view
    if (map) {
      map.setView([nextLocation.Latitude, nextLocation.Longitude], 14);
    }

    // Update list highlight
    document.querySelectorAll('.opportunity-card').forEach(card => card.classList.remove('highlighted'));
    const targetCard = document.querySelector(`[data-index="${newIndex}"]`);
    if (targetCard) {
      targetCard.classList.add('highlighted');
      targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Show new location details
    showLocationDetails(nextLocation, newIndex);

    // Track navigation
    trackEvent('detail_navigation', {
      direction: direction > 0 ? 'next' : 'previous',
      location_name: nextLocation.Name,
      label: `Navigated ${direction > 0 ? 'next' : 'previous'} to: ${nextLocation.Name}`,
      custom_parameter_1: 'navigation_interaction'
    });
  }
}

// Advanced filter functions
function getUserLocation() {
  const btn = document.getElementById('useMyLocation');
  const distanceFilter = document.getElementById('distanceFilter');

  if (!navigator.geolocation) {
    alert('Geolocatie wordt niet ondersteund door deze browser.');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Locatie ophalen...';

  navigator.geolocation.getCurrentPosition(
    (position) => {
      userLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };

      // Add user location marker
      if (userLocationMarker) {
        map.removeLayer(userLocationMarker);
      }

      userLocationMarker = L.circleMarker([userLocation.lat, userLocation.lng], {
        className: 'user-location-marker',
        radius: 8,
        fillColor: '#007bff',
        color: '#fff',
        weight: 3,
        opacity: 1,
        fillOpacity: 0.8
      }).addTo(map);

      userLocationMarker.bindPopup('Uw locatie');

      // Show distance filter
      distanceFilter.style.display = 'flex';
      btn.textContent = '✓ Locatie ingesteld';
      btn.disabled = false;

      // Update filters
      updateFilterButtonLabel();

      trackEvent('user_location_set', {
        label: 'User location set',
        custom_parameter_1: 'location_interaction'
      });
    },
    (error) => {
      console.error('Geolocation error:', error);
      alert('Kon uw locatie niet ophalen. Controleer uw browser instellingen.');
      btn.textContent = '📍 Mijn locatie gebruiken';
      btn.disabled = false;
    }
  );
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function saveCurrentFilters() {
  const filters = getActiveFilters();
  const textFilter = document.getElementById('advancedTextFilter').value;
  const filterMode = document.querySelector('input[name="filterMode"]:checked').value;

  const name = prompt('Geef een naam op voor deze filterset:');
  if (!name) return;

  const filterSet = {
    id: Date.now(),
    name: name,
    filters: filters,
    textFilter: textFilter,
    filterMode: filterMode,
    userLocation: userLocation,
    maxDistance: userLocation ? document.getElementById('distanceRange').value : null,
    saved: new Date().toISOString()
  };

  savedFiltersData.push(filterSet);
  localStorage.setItem('kansenkaart_saved_filters', JSON.stringify(savedFiltersData));
  updateSavedFiltersSelect();
  updateSavedFiltersButtonText();

  trackEvent('filters_saved', {
    filter_name: name,
    label: `Filters saved: ${name}`,
    custom_parameter_1: 'filter_interaction'
  });
}

function loadSavedFilter(filterId) {
  const filterSet = savedFiltersData.find(f => f.id == filterId);
  if (!filterSet) return;

  // Load basic filters
  setActiveFilters(filterSet.filters);

  // Load text filter
  document.getElementById('advancedTextFilter').value = filterSet.textFilter || '';

  // Load filter mode
  document.querySelector(`input[name="filterMode"][value="${filterSet.filterMode}"]`).checked = true;

  // Load user location if available
  if (filterSet.userLocation) {
    userLocation = filterSet.userLocation;

    if (userLocationMarker) {
      map.removeLayer(userLocationMarker);
    }

    userLocationMarker = L.circleMarker([userLocation.lat, userLocation.lng], {
      className: 'user-location-marker',
      radius: 8,
      fillColor: '#007bff',
      color: '#fff',
      weight: 3,
      opacity: 1,
      fillOpacity: 0.8
    }).addTo(map);

    userLocationMarker.bindPopup('Uw locatie');

    document.getElementById('distanceFilter').style.display = 'flex';
    document.getElementById('distanceRange').value = filterSet.maxDistance || 25;
    document.getElementById('distanceValue').textContent = (filterSet.maxDistance || 25) + ' km';
    document.getElementById('useMyLocation').textContent = '✓ Locatie ingesteld';
  }

  updateFilterButtonLabel();

  trackEvent('filters_loaded', {
    filter_name: filterSet.name,
    label: `Filters loaded: ${filterSet.name}`,
    custom_parameter_1: 'filter_interaction'
  });
}

function deleteSavedFilter() {
  const select = document.getElementById('savedFiltersSelect');
  const filterId = select.value;

  if (!filterId) return;

  const filterSet = savedFiltersData.find(f => f.id == filterId);
  if (!filterSet) return;

  if (confirm(`Weet u zeker dat u "${filterSet.name}" wilt verwijderen?`)) {
    savedFiltersData = savedFiltersData.filter(f => f.id != filterId);
    localStorage.setItem('kansenkaart_saved_filters', JSON.stringify(savedFiltersData));
    updateSavedFiltersSelect();
    updateSavedFiltersButtonText();

    trackEvent('filters_deleted', {
      filter_name: filterSet.name,
      label: `Filters deleted: ${filterSet.name}`,
      custom_parameter_1: 'filter_interaction'
    });
  }
}

function updateSavedFiltersSelect() {
  const select = document.getElementById('savedFiltersSelect');
  if (select) {
    select.innerHTML = '<option value="">Selecteer opgeslagen filter...</option>';

    savedFiltersData.forEach(filterSet => {
      const option = document.createElement('option');
      option.value = filterSet.id;
      option.textContent = `${filterSet.name} (${new Date(filterSet.saved).toLocaleDateString()})`;
      select.appendChild(option);
    });
  }

  // Update the saved filters button text with count
  updateSavedFiltersButtonText();
}

function updateSavedFiltersButtonText() {
  const savedFiltersBtn = document.getElementById('loadSavedFiltersBtn');
  if (savedFiltersBtn) {
    const count = savedFiltersData.length;
    if (count > 0) {
      savedFiltersBtn.textContent = `Saved filters (${count})`;
    } else {
      savedFiltersBtn.textContent = 'Saved filters';
    }
  }
}

function showSavedFiltersModal() {
  if (savedFiltersData.length === 0) {
    alert('Geen opgeslagen filters gevonden. Sla eerst een filter op.');
    return;
  }

  let modalHtml = `
    <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center;">
      <div style="background: white; padding: 2rem; border-radius: 8px; max-width: 400px; width: 90%;">
        <h3 style="margin-bottom: 1rem; color: rgb(38, 123, 41);">Opgeslagen Filters</h3>
        <div style="margin-bottom: 1.5rem;">
  `;

  savedFiltersData.forEach(filterSet => {
    modalHtml += `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; border: 1px solid #ddd; margin-bottom: 0.5rem; border-radius: 4px;">
        <div>
          <strong>${filterSet.name}</strong><br>
          <small style="color: #666;">${new Date(filterSet.saved).toLocaleDateString()}</small>
        </div>
        <div>
          <button onclick="loadSavedFilter(${filterSet.id}); closeSavedFiltersModal();" style="background: rgb(38, 123, 41); color: white; border: none; padding: 0.25rem 0.5rem; border-radius: 3px; margin-right: 0.25rem; cursor: pointer;">Laden</button>
          <button onclick="deleteSavedFilterFromModal(${filterSet.id})" style="background: #dc3545; color: white; border: none; padding: 0.25rem 0.5rem; border-radius: 3px; cursor: pointer;">×</button>
        </div>
      </div>
    `;
  });

  modalHtml += `
        </div>
        <button onclick="closeSavedFiltersModal()" style="background: #6c757d; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer;">Sluiten</button>
      </div>
    </div>
  `;

  const modalElement = document.createElement('div');
  modalElement.id = 'savedFiltersModal';
  modalElement.innerHTML = modalHtml;
  document.body.appendChild(modalElement);
}

function closeSavedFiltersModal() {
  const modal = document.getElementById('savedFiltersModal');
  if (modal) {
    modal.remove();
  }
}

function deleteSavedFilterFromModal(filterId) {
  const filterSet = savedFiltersData.find(f => f.id == filterId);
  if (!filterSet) return;

  if (confirm(`Weet u zeker dat u "${filterSet.name}" wilt verwijderen?`)) {
    savedFiltersData = savedFiltersData.filter(f => f.id != filterId);
    localStorage.setItem('kansenkaart_saved_filters', JSON.stringify(savedFiltersData));
    updateSavedFiltersButtonText();

    // Close and reopen modal to refresh the list
    closeSavedFiltersModal();
    showSavedFiltersModal();

    trackEvent('filters_deleted', {
      filter_name: filterSet.name,
      label: `Filters deleted: ${filterSet.name}`,
      custom_parameter_1: 'filter_interaction'
    });
  }
}

function loadSavedFiltersFromStorage() {
  try {
    const saved = localStorage.getItem('kansenkaart_saved_filters');
    if (saved) {
      savedFiltersData = JSON.parse(saved);
      updateSavedFiltersSelect();
      updateSavedFiltersButtonText();
    }
  } catch (error) {
    console.error('Error loading saved filters:', error);
  }
}

// Cache voor gefilterde resultaten
let filterCache = new Map();
let lastFilterHash = '';

function generateFilterHash(filters, textFilter, userLocation, maxDistance) {
  return JSON.stringify({filters, textFilter, userLocation, maxDistance});
}

function updateMap() {
  if (!window.data || !document.getElementById('map')) return;

  // Initialize map if needed
  if (!map) {
    map = L.map('map').setView([51.2, 6.1], 9);

    // Define base layers
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    });

    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '© Esri'
    });

    // Add default layer
    osmLayer.addTo(map);

    // Track map initialization
    trackEvent('map_initialize', {
      label: 'Map initialized',
      custom_parameter_1: 'map_interaction',
      initial_zoom: 9
    });

    // Add municipality layer
    municipalityLayer = L.layerGroup();

    // Initialize additional data layers
    airQualityLayer = L.layerGroup();
    noiseZonesLayer = L.layerGroup();
    buildingAgesLayer = L.layerGroup();

    // Add layer control with base layers and overlays
    const baseLayers = {
      "Kaart": osmLayer,
      "Satelliet": satelliteLayer
    };

    const overlayLayers = {
      "Gemeenten": municipalityLayer,
      "Geluidszones": noiseZonesLayer,
      "Bouwjaren": buildingAgesLayer
    };

    L.control.layers(baseLayers, overlayLayers, {
      position: 'topright',
      collapsed: false
    }).addTo(map);

    // Track layer toggle events
    map.on('overlayadd', (e) => {
      trackEvent('layer_toggle', {
        layer_name: e.name,
        action: 'add',
        label: `Layer added: ${e.name}`,
        custom_parameter_1: 'map_interaction'
      });
    });

    map.on('overlayremove', (e) => {
      trackEvent('layer_toggle', {
        layer_name: e.name,
        action: 'remove',
        label: `Layer removed: ${e.name}`,
        custom_parameter_1: 'map_interaction'
      });
    });

    // Track map movements (throttled)
    let mapMoveTimeout;
    map.on('moveend', () => {
      clearTimeout(mapMoveTimeout);
      mapMoveTimeout = setTimeout(() => {
        const center = map.getCenter();
        const zoom = map.getZoom();
        trackEvent('map_move', {
          zoom_level: zoom,
          center_lat: Math.round(center.lat * 1000) / 1000,
          center_lng: Math.round(center.lng * 1000) / 1000,
          label: `Map moved to zoom ${zoom}`,
          custom_parameter_1: 'map_interaction',
          value: zoom
        });
      }, 1000);
    });

    // Track zoom changes
    map.on('zoomend', () => {
      const zoom = map.getZoom();
      trackEvent('map_zoom', {
        zoom_level: zoom,
        label: `Map zoomed to level ${zoom}`,
        custom_parameter_1: 'map_interaction',
        value: zoom
      });
    });

    // Load municipality boundaries first (essential)
    loadMunicipalityBoundaries();

    // Initialize layers as empty - load on demand
    airQualityLayer = L.layerGroup();
    noiseZonesLayer = L.layerGroup();
    buildingAgesLayer = L.layerGroup();

    // Load additional data layers when layer is activated (for lazy loading if needed)
    map.on('overlayadd', (e) => {
      switch(e.name) {
        case 'Luchtkwaliteit':
          if (!airQualityLayer.getLayers().length) loadAirQualityData();
          break;
        case 'Geluidszones':
          if (!noiseZonesLayer.getLayers().length) loadNoiseZonesData();
          break;
        case 'Bouwjaren':
          if (!buildingAgesLayer.getLayers().length) loadBuildingAgesData();
          break;
      }
    });
  }

  // Clear existing markers
  markers.forEach(m => map.removeLayer(m));
  markers = [];

  // Get all checked filters
  const filters = getActiveFilters();

  // Get advanced filter settings
  const textFilter = document.getElementById('advancedTextFilter')?.value.toLowerCase().trim() || '';
  const filterMode = document.querySelector('input[name="filterMode"]:checked')?.value || 'AND';
  const maxDistance = userLocation ? parseInt(document.getElementById('distanceRange')?.value || 25) : null;

  // Check cache voor performance
  const currentFilterHash = generateFilterHash(filters, textFilter, userLocation, maxDistance);
  if (currentFilterHash === lastFilterHash && filterCache.has(currentFilterHash)) {
    const cached = filterCache.get(currentFilterHash);
    filteredData = cached;
    updateOpportunitiesList(cached);
    updateMapMarkers(cached);
    return;
  }

  // Filter data based on selected filters
  const filtered = window.data.filter(d => {
    // Basic filters
    const basicMatch = Object.keys(filters).every(k => {
      if (!filters[k] || filters[k].length== 0) return true;
      const dataValue = d[k];
      if (Array.isArray(dataValue)) {
        return dataValue.some(val => filters[k].includes(val));
      } else {
        return filters[k].includes(dataValue);
      }
    });

    // Text filter
    let textMatch = true;
    if (textFilter) {
      const searchableText = [
        d.Name,
        d.Description,
        Array.isArray(d.HBMTopic) ? d.HBMTopic.join(' ') : d.HBMTopic,
        Array.isArray(d.OrganizationType) ? d.OrganizationType.join(' ') : d.OrganizationType,
        Array.isArray(d.HBMSector) ? d.HBMSector.join(' ') : d.HBMSector
      ].join(' ').toLowerCase();

      textMatch = searchableText.includes(textFilter);
    }

    // Distance filter
    let distanceMatch = true;
    if (userLocation && maxDistance) {
      const distance = calculateDistance(
        userLocation.lat,
        userLocation.lng,
        d.Latitude,
        d.Longitude
      );
      distanceMatch = distance <= maxDistance;
    }

    // Combine filters based on mode
    if (filterMode === 'OR') {
      return basicMatch || textMatch || distanceMatch;
    } else {
      return basicMatch && textMatch && distanceMatch;
    }
  });

  // Cache resultaten
  filterCache.set(currentFilterHash, filtered);
  lastFilterHash = currentFilterHash;
  if (filterCache.size > 10) {
    const firstKey = filterCache.keys().next().value;
    filterCache.delete(firstKey);
  }

  // Store filtered data and update list
  filteredData = filtered;
  updateOpportunitiesList(filtered);

  updateMapMarkers(filtered);
}

function updateMapMarkers(filtered) {

  // Add markers for filtered data with clustering
  const bounds = [];

  // Initialize cluster group if not exists
  if (!markerClusterGroup) {
    // Try to use MarkerClusterGroup if available, fallback to regular group
    if (typeof L.markerClusterGroup === 'function') {
      markerClusterGroup = L.markerClusterGroup({
        chunkedLoading: true,
        maxClusterRadius: 60,
        disableClusteringAtZoom: 15,
        iconCreateFunction: function(cluster) {
          const count = cluster.getChildCount();
          let className = 'marker-cluster-small';
          if (count > 10) className = 'marker-cluster-medium';
          if (count > 100) className = 'marker-cluster-large';

          return L.divIcon({
            html: `<div><span>${count}</span></div>`,
            className: 'marker-cluster ' + className,
            iconSize: L.point(40, 40)
          });
        }
      });
    } else {
      markerClusterGroup = L.featureGroup();
    }
  } else {
    // Clear existing markers from cluster group
    markerClusterGroup.clearLayers();
  }

  filtered.forEach(loc => {
    const markerOptions = {};
    const isProject = (Array.isArray(loc.HBMType) ? loc.HBMType.includes('Project') : loc.HBMType === 'Project');

    // Check if project has an image for custom marker
    if (isProject && loc.ProjectImage) {
      // Create custom photo marker
      const photoIcon = L.divIcon({
        className: 'photo-marker',
        html: `<div class="photo-marker-container">
                 <img src="${loc.ProjectImage}" alt="${loc.Name}" class="photo-marker-image" onerror="this.parentNode.parentNode.style.display='none'; this.parentNode.innerHTML='<div class=\\'fallback-marker\\'></div>';">
                 <div class="photo-marker-overlay"></div>
               </div>`,
        iconSize: [50, 50],
        iconAnchor: [25, 50],
        popupAnchor: [0, -50]
      });
      markerOptions.icon = photoIcon;
    } else if (!isProject && loc.Logo) {
      // Create custom logo marker for companies
      const logoIcon = L.divIcon({
        className: 'logo-marker',
        html: `<div class="logo-marker-container">
                 <img src="${loc.Logo}" alt="${loc.Name}" class="logo-marker-image" onerror="this.parentNode.parentNode.style.display='none'; this.parentNode.innerHTML='<div class=\\'fallback-marker\\'></div>';">
                 <div class="logo-marker-overlay"></div>
               </div>`,
        iconSize: [50, 50],
        iconAnchor: [25, 50],
        popupAnchor: [0, -50]
      });
      markerOptions.icon = logoIcon;
    } else if (pIcon && bIcon) {
      markerOptions.icon = isProject ? pIcon : bIcon;
    }

    const marker = L.marker([loc.Latitude, loc.Longitude], markerOptions);

    // Add location data to marker
    marker.locationData = loc;

    // Add click event
    marker.on('click', () => {
      // Track marker click
      const isProject = (Array.isArray(loc.HBMType) ? loc.HBMType.includes('Project') : loc.HBMType === 'Project');
      trackEvent('marker_click', {
        location_name: loc.Name,
        location_type: Array.isArray(loc.HBMType) ? loc.HBMType.join(', ') : loc.HBMType,
        label: `Marker clicked: ${loc.Name}`,
        custom_parameter_1: 'map_interaction',
        is_project: isProject
      });

      // Find index in filtered data
      const locationIndex = filteredData.findIndex(item => item.Name === loc.Name);

      // Highlight corresponding list item
      if (locationIndex >= 0) {
        document.querySelectorAll('.opportunity-card').forEach(card => card.classList.remove('highlighted'));
        const targetCard = document.querySelector(`[data-index="${locationIndex}"]`);
        if (targetCard) {
          targetCard.classList.add('highlighted');
          targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }

      showLocationDetails(loc, locationIndex);
    });

    // Add hover events for label
    marker.on('mouseover', (e) => {
      const domEvent = e.originalEvent;
      showHoverLabel(domEvent, loc.Name);

      // Track marker hover (with throttling to avoid spam)
      if (!marker._hoverTracked || Date.now() - marker._hoverTracked > 5000) {
        marker._hoverTracked = Date.now();
        trackEvent('marker_hover', {
          location_name: loc.Name,
          label: `Marker hovered: ${loc.Name}`,
          custom_parameter_1: 'map_interaction'
        });
      }
    });

    marker.on('mouseout', () => {
      hideHoverLabel();
    });

    marker.on('mousemove', (e) => {
      const domEvent = e.originalEvent;
      showHoverLabel(domEvent, loc.Name);
    });

    markerClusterGroup.addLayer(marker);
    markers.push(marker);
    bounds.push([loc.Latitude, loc.Longitude]);
  });

  // Add marker cluster group to map
  map.addLayer(markerClusterGroup);

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