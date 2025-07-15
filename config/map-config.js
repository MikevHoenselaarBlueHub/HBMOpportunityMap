// Map Configuration
const mapConfig = {
  // Default map center (Euregio Maas-Rijn)
  defaultCenter: [51.2, 6.0],
  defaultZoom: 9,

  // Tile layer configuration for simplified map
  tileLayer: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    options: {
      subdomains: 'abcd',
      maxZoom: 20
    }
  },

  // Municipality styling
  municipalityStyle: {
    default: {
      color: 'rgb(38, 123, 41)',
      weight: 4,
      opacity: 0.9,
      fillColor: 'rgb(38, 123, 41)',
      fillOpacity: 0.1,
      smoothFactor: 0.5,
      dashArray: '5, 8'
    },
    hover: {
      color: 'rgb(38, 123, 41)',
      weight: 6,
      opacity: 1,
      fillColor: 'rgb(38, 123, 41)',
      fillOpacity: 0.3,
      dashArray: '5, 8'
    }
  },

  // Marker configuration
  markers: {
    project: {
      iconUrl: 'icons/marker-project.svg',
      iconSize: [30, 40],
      iconAnchor: [15, 40],
      popupAnchor: [0, -40]
    },
    company: {
      iconUrl: 'icons/marker-company.svg', 
      iconSize: [30, 40],
      iconAnchor: [15, 40],
      popupAnchor: [0, -40]
    }
  },

  // Cluster configuration
  cluster: {
    maxClusterRadius: 50,
    spiderfyOnMaxZoom: true
  }
};

// Data paths
const dataPaths = {
  opportunities: 'data/opportunities.json',
  dutchMunicipalities: 'data/geojson/nl-gemeenten.geojson',
  germanMunicipalities: 'data/geojson/de-gemeenten.geojson',
  townships: 'data/geojson/townships.geojson'
};

// Translation paths
const translationPaths = {
  nl: 'translations/nl.json',
  en: 'translations/en.json', 
  de: 'translations/de.json'
};