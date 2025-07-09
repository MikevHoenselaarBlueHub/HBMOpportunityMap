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
let map = L.map('map').setView([51.5, 6.1], 8);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
const pIcon = L.icon({ iconUrl: 'icons/marker-project.svg', iconSize: [30,40] });
const bIcon = L.icon({ iconUrl: 'icons/marker-company.svg', iconSize: [30,40] });
let markers = [];

fetch('opportunities.json')
  .then(r => r.json())
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

function createFilterCheckboxes() {
  const keys = ['ProjectType','OrganizationType','OrganizationField','HBMTopic','HBMCharacteristics','HBMSector'];
  keys.forEach(key => {
    const values = [...new Set(window.data.map(d => d[key]).filter(Boolean))];
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
    <p><strong>Type:</strong> ${location.HBMType}</p>
    <p><strong>Project type:</strong> ${location.ProjectType}</p>
    <p><strong>Organisatie:</strong> ${location.OrganizationType}</p>
    <p><strong>Vakgebied:</strong> ${location.OrganizationField}</p>
    <p><strong>Thema:</strong> ${location.HBMTopic}</p>
    <p><strong>Kenmerken:</strong> ${location.HBMCharacteristics}</p>
    <p><strong>Sector:</strong> ${location.HBMSector}</p>
    <p><strong>Beschrijving:</strong> ${location.Description}</p>
    <div style="margin-top: 1rem;">
      <button class="cta-btn">Contact opnemen</button>
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
  markers.forEach(m => map.removeLayer(m));
  markers = [];
  const filters = {};
  document.querySelectorAll('#filtersForm input[type="checkbox"]:checked').forEach(cb => {
    const name = cb.name;
    if (!filters[name]) filters[name] = [];
    filters[name].push(cb.value);
  });

  const filtered = window.data.filter(d => {
    return Object.keys(filters).every(k => !filters[k].length || filters[k].includes(d[k]));
  });

  const bounds = [];
  filtered.forEach(loc => {
    const icon = loc.HBMType === 'Project' ? pIcon : bIcon;
    const marker = L.marker([loc.Latitude, loc.Longitude], { icon }).addTo(map);
    marker.on('click', () => {
      showLocationDetails(loc);
    });
    markers.push(marker);
    bounds.push([loc.Latitude, loc.Longitude]);
  });

  if (bounds.length) map.fitBounds(bounds);
}
