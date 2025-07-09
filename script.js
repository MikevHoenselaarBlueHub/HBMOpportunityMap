
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
    const activeFilters = {};
    document.querySelectorAll('#filtersForm input[type="checkbox"]:checked').forEach(cb => {
      if (!activeFilters[cb.name]) activeFilters[cb.name] = [];
      activeFilters[cb.name].push(cb.value);
    });
    
    trackEvent('filter_apply', {
      label: 'Filters applied',
      custom_parameter_1: 'filter_interaction',
      filter_count: Object.keys(activeFilters).length,
      active_filters: JSON.stringify(activeFilters)
    });
    
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
if (document.getElementById('closeDetail')) {
  document.getElementById('closeDetail').onclick = () => {
    trackEvent('detail_panel_close', {
      label: 'Detail panel closed',
      custom_parameter_1: 'content_interaction'
    });
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

function updateOpportunitiesList(data) {
  const listContainer = document.getElementById('opportunitiesList');
  const resultsCount = document.getElementById('resultsCount');
  
  if (!listContainer || !resultsCount) return;
  
  resultsCount.textContent = `${data.length} ${t('results') || 'resultaten'}`;
  
  if (data.length === 0) {
    listContainer.innerHTML = `<div class="no-results">${t('noResults') || 'Geen resultaten gevonden'}</div>`;
    return;
  }
  
  listContainer.innerHTML = data.map((opportunity, index) => {
    const isProject = (Array.isArray(opportunity.HBMType) ? opportunity.HBMType.includes('Project') : opportunity.HBMType === 'Project');
    
    let imageHtml = '';
    if (isProject && opportunity.ProjectImage) {
      imageHtml = `<img src="${opportunity.ProjectImage}" alt="${opportunity.Name}" class="card-image" onerror="this.style.display='none'">`;
    } else if (!isProject && opportunity.Logo) {
      imageHtml = `<img src="${opportunity.Logo}" alt="${opportunity.Name}" class="card-logo" onerror="this.style.display='none'">`;
    }
    
    return `
      <div class="opportunity-card" data-index="${index}" onclick="selectOpportunity(${index})">
        <div class="card-header">
          <h4 class="card-title">${opportunity.Name}</h4>
          <span class="card-type-badge ${isProject ? 'project' : 'company'}">
            ${Array.isArray(opportunity.HBMType) ? opportunity.HBMType.join(', ') : opportunity.HBMType}
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
        .then(data => {
          window.data = data;
          
          // Track data load success
          trackEvent('data_load_success', {
            data_count: data.length,
            label: `Successfully loaded ${data.length} opportunities`,
            custom_parameter_1: 'data_interaction',
            value: data.length
          });
          
          createFilterCheckboxes();
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
    <a href="#" id="closeDetail" class="close-btn">
      <img src="icons/close.svg" alt="${t('close')}" class="close-icon"/>
    </a>
    
    <div class="detail-content">
      ${imageHtml}
      <div class="detail-header">
        <h2>${locationName}</h2>
        <div class="detail-header-right">
          <button class="detail-navigation prev" id="prevDetail" ${prevDisabled ? 'disabled' : ''}>
            ←
          </button>
          <button class="detail-navigation next" id="nextDetail" ${nextDisabled ? 'disabled' : ''}>
            →
          </button>
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

function updateMap() {
  if (!window.data || !document.getElementById('map')) return;

  // Initialize map if needed
  if (!map) {
    map = L.map('map').setView([51.2, 6.1], 9);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    
    // Track map initialization
    trackEvent('map_initialize', {
      label: 'Map initialized',
      custom_parameter_1: 'map_interaction',
      initial_zoom: 9
    });
    
    // Add municipality layer
    municipalityLayer = L.layerGroup();
    
    // Add layer control for overlays only
    const overlayLayers = {
      "Gemeenten": municipalityLayer
    };
    
    L.control.layers(null, overlayLayers, {
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

  // Store filtered data and update list
  filteredData = filtered;
  updateOpportunitiesList(filtered);

  // Add markers for filtered data with clustering
  const bounds = [];
  
  // Initialize cluster group if not exists
  if (!markerClusterGroup) {
    // Try to use MarkerClusterGroup if available, fallback to regular group
    if (typeof L.markerClusterGroup === 'function') {
      markerClusterGroup = L.markerClusterGroup({
        chunkedLoading: true,
        chunkProgress: function(processed, total) {
          // Optional: show loading progress
        },
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
        },
        // Don't cluster markers with custom icons (photos/logos)
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
