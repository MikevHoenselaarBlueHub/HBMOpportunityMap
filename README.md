
# HBM Kansenkaart

Een interactieve kaartapplicatie voor het ontdekken van gezond bouwen kansen in de Euregio Maas-Rijn regio.

## 📋 Projectoverzicht

De HBM Kansenkaart toont bedrijven en projecten die zich bezighouden met gezond bouwen in Nederland en Duitsland. Gebruikers kunnen filteren op verschillende criteria en hun eigen locatie gebruiken om relevante kansen in de buurt te vinden.

## 🏗️ Architectuur

```
├── config/                    # Configuratie bestanden
│   ├── map-config.js          # Kaart configuratie
│   └── utils.js               # Utility functies
├── data/                      # Data bestanden
│   ├── opportunities.json     # Hoofddata
│   └── geojson/              # Geografische data
│       ├── nl-gemeenten.geojson
│       ├── de-gemeenten.geojson
│       └── townships.geojson
├── icons/                     # SVG iconen
├── translations/              # Meertalige ondersteuning
│   ├── nl.json
│   ├── en.json
│   └── de.json
├── index.html                 # Hoofdpagina
├── script.js                  # Hoofdapplicatie logic
├── style.css                  # Styling
└── sw.js                      # Service Worker
```

## 🚀 Functionaliteiten

### Kaart Functionaliteiten
- ✅ Interactieve kaart met Leaflet.js
- ✅ Projecten en bedrijven markers
- ✅ Gemeente grenzen (Nederland & Duitsland)
- ✅ Cluster functionaliteit voor markers
- ✅ Responsive design

### Filter Opties
- ✅ Type organisatie (Project/Bedrijf)
- ✅ Project type
- ✅ Organisatie type
- ✅ HBM onderwerpen
- ✅ Sectoren
- ✅ Gemeenten
- ✅ Locatie + radius filter

### Data Management
- ✅ Geocoding voor ontbrekende coördinaten
- ✅ GeoJSON data voor gemeente grenzen
- ✅ JSON data voor opportuniteiten
- ✅ Meertalige ondersteuning

### Performance
- ✅ Service Worker voor offline functionaliteit
- ✅ Optimale kaart styling voor performance
- ✅ Efficient data loading

## 🛠️ Technische Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Kaart**: Leaflet.js + MarkerCluster
- **Data**: GeoJSON, JSON
- **Offline**: Service Worker
- **Hosting**: Replit

## 📱 Browser Ondersteuning

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## 🔧 Development

### Lokaal draaien
```bash
npm start
```

De applicatie draait op `http://localhost:5000`

### Data Updates
1. Opportunities data: `data/opportunities.json`
2. Gemeente data: `data/geojson/`
3. Vertalingen: `translations/`

### Configuratie
Kaart instellingen kunnen aangepast worden in `config/map-config.js`

## 📊 Analytics

Google Analytics 4 events worden getrackt voor:
- Pagina views
- Filter gebruik
- Marker clicks
- Gemeente clicks
- Locatie gebruik

## 🌐 Deployment

De applicatie is geoptimaliseerd voor Replit deployment:
- Automatische HTTPS
- CDN caching
- Global availability

## 🐛 Debugging

Console logs zijn beschikbaar voor:
- Data loading status
- Geocoding results
- Municipality loading
- Filter applications

## 📄 Licentie

Copyright © 2024 Healthy Building Movement
