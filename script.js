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
      document.getElementById('detailPanel').classList.add('open');
      // Vul detailPanel content hier aan
    });
    markers.push(marker);
    bounds.push([loc.Latitude, loc.Longitude]);
  });

  if (bounds.length) map.fitBounds(bounds);
}
