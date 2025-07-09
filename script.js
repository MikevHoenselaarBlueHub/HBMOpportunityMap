// Internationalization
const translations = {
  nl: {
    selectAll: 'Selecteer alles',
    selectNone: 'Selecteer geen',
    apply: 'Toepassen',
    noSelection: 'Maak een keuze uit een van de filters',
    projectType: 'Type project',
    organizationType: 'Organisatietype',
    organizationField: 'Vakgebied',
    hbmTopic: 'Thema',
    hbmCharacteristics: 'Kenmerken',
    hbmSector: 'Sector',
    projects: 'Projecten',
    companies: 'Bedrijven',
    type: 'Type',
    organization: 'Organisatie',
    field: 'Vakgebied',
    topic: 'Thema',
    characteristics: 'Kenmerken',
    sector: 'Sector',
    description: 'Beschrijving',
    contact: 'Contact opnemen',
    moreInfo: 'Meer info',
    aboutHBM: 'Over HBM',
    close: 'Sluiten',
    filters: 'Filters',
    opportunityMap: 'Kansenkaart',
    dataLoadError: 'Fout bij het laden van de data. Probeer de pagina te vernieuwen.',
    leafletLoadError: 'Kaart bibliotheek kon niet worden geladen.'
  },
  en: {
    selectAll: 'Select all',
    selectNone: 'Select none',
    apply: 'Apply',
    noSelection: 'Make a choice from one of the filters',
    projectType: 'Project type',
    organizationType: 'Organization type',
    organizationField: 'Field',
    hbmTopic: 'Topic',
    hbmCharacteristics: 'Characteristics',
    hbmSector: 'Sector',
    projects: 'Projects',
    companies: 'Companies',
    type: 'Type',
    organization: 'Organization',
    field: 'Field',
    topic: 'Topic',
    characteristics: 'Characteristics',
    sector: 'Sector',
    description: 'Description',
    contact: 'Contact',
    moreInfo: 'More info',
    aboutHBM: 'About HBM',
    close: 'Close',
    filters: 'Filters',
    opportunityMap: 'Opportunity Map',
    dataLoadError: 'Error loading data. Please refresh the page.',
    leafletLoadError: 'Map library could not be loaded.'
  },
  de: {
    selectAll: 'Alle auswählen',
    selectNone: 'Keine auswählen',
    apply: 'Anwenden',
    noSelection: 'Treffen Sie eine Auswahl aus einem der Filter',
    projectType: 'Projekttyp',
    organizationType: 'Organisationstyp',
    organizationField: 'Fachbereich',
    hbmTopic: 'Thema',
    hbmCharacteristics: 'Merkmale',
    hbmSector: 'Sektor',
    projects: 'Projekte',
    companies: 'Unternehmen',
    type: 'Typ',
    organization: 'Organisation',
    field: 'Fachbereich',
    topic: 'Thema',
    characteristics: 'Merkmale',
    sector: 'Sektor',
    description: 'Beschreibung',
    contact: 'Kontakt aufnehmen',
    moreInfo: 'Mehr Infos',
    aboutHBM: 'Über HBM',
    close: 'Schließen',
    filters: 'Filter',
    opportunityMap: 'Chancenkarte',
    dataLoadError: 'Fehler beim Laden der Daten. Bitte aktualisieren Sie die Seite.',
    leafletLoadError: 'Kartenbibliothek konnte nicht geladen werden.'
  }
};

let currentLanguage = 'nl';

function t(key) {
  return translations[currentLanguage][key] || key;
}

function setLanguage(lang) {
  currentLanguage = lang;
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
    if (translations[currentLanguage][key]) {
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

// Kaart & markers
let map, markers = [];
let pIcon, bIcon;

// Initialize map only if we're on the map page
if (document.getElementById('map')) {
  // Function to initialize everything when Leaflet is ready
  function initializeApp() {
    if (typeof L !== 'undefined') {
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
      
      // Data laden
      fetch('opportunities.json')
        .then(res => res.json())
        .then(data => {
          window.data = data;
          createFilterCheckboxes();
          updateMap();
        })
        .catch(error => {
          console.error('Error loading data:', error);
          const mapElement = document.getElementById('map');
          mapElement.innerHTML = '<div style="padding: 2rem; text-align: center; color: #666;">Fout bij het laden van de data. Probeer de pagina te vernieuwen.</div>';
        });
    } else {
      // Retry after a short delay
      setTimeout(initializeApp, 100);
    }
  }

  // Wait for DOM and then initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initializeApp();
      updateUI();
    });
  } else {
    initializeApp();
    updateUI();
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
  detailPanel.innerHTML = `
    <a href="#" id="closeDetail" class="close-btn">
      <img src="icons/close.svg" alt="${t('close')}" class="close-icon"/>
    </a>
    <h2>${location.Name}</h2>
    <p><strong>${t('type')}:</strong> ${Array.isArray(location.HBMType) ? location.HBMType.join(', ') : location.HBMType}</p>
    <p><strong>${t('projectType')}:</strong> ${Array.isArray(location.ProjectType) ? location.ProjectType.join(', ') : location.ProjectType}</p>
    <p><strong>${t('organizationType')}:</strong> ${Array.isArray(location.OrganizationType) ? location.OrganizationType.join(', ') : location.OrganizationType}</p>
    <p><strong>${t('organizationField')}:</strong> ${Array.isArray(location.OrganizationField) ? location.OrganizationField.join(', ') : location.OrganizationField}</p>
    <p><strong>${t('hbmTopic')}:</strong> ${Array.isArray(location.HBMTopic) ? location.HBMTopic.join(', ') : location.HBMTopic}</p>
    <p><strong>${t('hbmCharacteristics')}:</strong> ${Array.isArray(location.HBMCharacteristics) ? location.HBMCharacteristics.join(', ') : location.HBMCharacteristics}</p>
    <p><strong>${t('hbmSector')}:</strong> ${Array.isArray(location.HBMSector) ? location.HBMSector.join(', ') : location.HBMSector}</p>
    <p><strong>${t('description')}:</strong> ${location.Description}</p>
    <div style="margin-top: 1rem;">
      <button class="btn-primary">${t('contact')}</button>
      <button class="btn-secondary">${t('moreInfo')}</button>
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
    marker.on('click', () => {
      showLocationDetails(loc);
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