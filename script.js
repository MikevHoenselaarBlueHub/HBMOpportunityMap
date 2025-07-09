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
  };
}
if (document.getElementById('selectNone')) {
  document.getElementById('selectNone').onclick = () => {
    document.querySelectorAll('#filtersForm input[type="checkbox"]').forEach(cb => cb.checked = false);
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
    document.addEventListener('DOMContentLoaded', initializeApp);
  } else {
    initializeApp();
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
        container.innerHTML += `<label><input type="checkbox" name="${key}" value="${val}" checked/> ${val}</label> `;
      });
    }
  });
}

function showLocationDetails(location) {
  const detailPanel = document.getElementById('detailPanel');
  detailPanel.innerHTML = `
    <a href="#" id="closeDetail" class="close-btn">
      <img src="icons/close.svg" alt="Sluiten" class="close-icon"/>
    </a>
    <h2>${location.Name}</h2>
    <p><strong>Type:</strong> ${Array.isArray(location.HBMType) ? location.HBMType.join(', ') : location.HBMType}</p>
    <p><strong>Project type:</strong> ${Array.isArray(location.ProjectType) ? location.ProjectType.join(', ') : location.ProjectType}</p>
    <p><strong>Organisatie:</strong> ${Array.isArray(location.OrganizationType) ? location.OrganizationType.join(', ') : location.OrganizationType}</p>
    <p><strong>Vakgebied:</strong> ${Array.isArray(location.OrganizationField) ? location.OrganizationField.join(', ') : location.OrganizationField}</p>
    <p><strong>Thema:</strong> ${Array.isArray(location.HBMTopic) ? location.HBMTopic.join(', ') : location.HBMTopic}</p>
    <p><strong>Kenmerken:</strong> ${Array.isArray(location.HBMCharacteristics) ? location.HBMCharacteristics.join(', ') : location.HBMCharacteristics}</p>
    <p><strong>Sector:</strong> ${Array.isArray(location.HBMSector) ? location.HBMSector.join(', ') : location.HBMSector}</p>
    <p><strong>Beschrijving:</strong> ${location.Description}</p>
    <div style="margin-top: 1rem;">
      <button class="btn-primary">Contact opnemen</button>
      <button class="btn-secondary">Meer info</button>
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

  // Clear markers
  markers.forEach(m => map.removeLayer(m));
  markers = [];
  const filters = {};
  document.querySelectorAll('#filtersForm input[type="checkbox"]:checked').forEach(cb => {
    const name = cb.name;
    if (!filters[name]) filters[name] = [];
    filters[name].push(cb.value);
  });

  const filtered = window.data.filter(d => {
    return Object.keys(filters).every(k => {
      if (!filters[k].length) return true;
      const dataValue = d[k];
      if (Array.isArray(dataValue)) {
        return dataValue.some(val => filters[k].includes(val));
      } else {
        return filters[k].includes(dataValue);
      }
    });
  });

  const bounds = [];
  filtered.forEach(loc => {
    // Use default icon if custom icons not loaded
    const markerOptions = {};
    if (pIcon && bIcon) {
      markerOptions.icon = loc.HBMType === 'Project' ? pIcon : bIcon;
    }
    
    const marker = L.marker([loc.Latitude, loc.Longitude], markerOptions).addTo(map);
    marker.on('click', () => {
      showLocationDetails(loc);
    });
    markers.push(marker);
    bounds.push([loc.Latitude, loc.Longitude]);
  });

  // Zoom to show all markers with padding
  if (bounds.length > 0) {
    if (bounds.length === 1) {
      // Single marker - center on it with reasonable zoom
      map.setView(bounds[0], 12);
    } else {
      // Multiple markers - fit bounds with padding
      map.fitBounds(bounds, {
        padding: [20, 20],
        maxZoom: 15
      });
    }
  } else {
    // No markers - show default view
    map.setView([51.2, 6.1], 9);
  }
}