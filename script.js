
// Global variables
let currentLanguage = 'nl';
let translations = {};
let map, markers = [];
let pIcon, bIcon;
let hoverLabel;

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
  
  detailPanel.innerHTML = `
    <a href="#" id="closeDetail" class="close-btn">
      <img src="icons/close.svg" alt="${t('close')}" class="close-icon"/>
    </a>
    <div class="detail-content">
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

  // Add markers for filtered data
  const bounds = [];
  filtered.forEach(loc => {
    const markerOptions = {};
    if (pIcon && bIcon) {
      markerOptions.icon = (Array.isArray(loc.HBMType) ? loc.HBMType.includes('Project') : loc.HBMType === 'Project') ? pIcon : bIcon;
    }
    
    const marker = L.marker([loc.Latitude, loc.Longitude], markerOptions).addTo(map);
    
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
    
    markers.push(marker);
    bounds.push([loc.Latitude, loc.Longitude]);
  });

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
