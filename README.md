
# HBM Kansenkaart

Een interactieve kaartapplicatie voor het ontdekken van gezond bouwen kansen in de Euregio Maas-Rijn regio.

## 📋 Projectoverzicht

De HBM Kansenkaart toont bedrijven en projecten die zich bezighouden met gezond bouwen in Nederland en Duitsland. Gebruikers kunnen filteren op verschillende criteria en hun eigen locatie gebruiken om relevante kansen in de buurt te vinden.

## 🏗️ Architectuur

```
├── config/                    # Configuratie bestanden
│   ├── map-config.js          # Kaart configuratie
│   ├── utils.js               # Utility functies
│   └── version.js             # Versie management
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

## 🚀 Werkende Functionaliteiten

### Kaart Functionaliteiten
- ✅ Interactieve kaart met Leaflet.js
- ✅ Projecten en bedrijven markers
- ✅ Gemeente grenzen (Nederland & Duitsland)
- ✅ Cluster functionaliteit voor markers
- ✅ Responsive design
- ✅ Detail panel met navigatie

### Filter Opties
- ✅ Type organisatie (Project/Bedrijf)
- ✅ Locatie + radius filter
- ✅ Opslaan en laden van filters
- ✅ URL state management
- ✅ Lijst/kaart toggle

### Data Management
- ✅ Geocoding voor ontbrekende coördinaten
- ✅ GeoJSON data voor gemeente grenzen
- ✅ JSON data voor opportuniteiten
- ✅ Meertalige ondersteuning (NL/EN/DE)

### Performance
- ✅ Service Worker voor offline functionaliteit
- ✅ Optimale kaart styling voor performance
- ✅ Efficient data loading
- ✅ Cache management

## ⚠️ Beperkt Werkende Functionaliteiten

### Filter Opties
- ⚠️ Project type filters - UI is aanwezig maar data filtering werkt beperkt
- ⚠️ Organisatie type filters - niet volledig geïmplementeerd
- ⚠️ HBM onderwerpen filters - UI aanwezig, data beperkt
- ⚠️ Sectoren filters - beperkte data beschikbaar
- ⚠️ Gemeente filters - UI aanwezig maar niet volledig werkend

### Formulieren & Contact
- ❌ Contact formulieren - placeholder functionaliteit
- ❌ Formspree/Netlify Forms integratie - niet geconfigureerd
- ❌ Email verzending - niet geïmplementeerd

### Analytics
- ⚠️ Google Analytics 4 - placeholder ID, moet geconfigureerd worden

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
npx serve . -l 5000
```

De applicatie draait op `http://localhost:5000`

### Configuratie Vereist
1. **Google Analytics**: Vervang 'G-XXXXXXXXXX' in index.html met werkelijke GA4 ID
2. **Contact Forms**: Configureer Formspree of Netlify Forms endpoint
3. **Email**: Stel email verzending in voor contactformulieren

### Data Updates
1. Opportunities data: `data/opportunities.json`
2. Gemeente data: `data/geojson/`
3. Vertalingen: `translations/`
4. Kaart configuratie: `config/map-config.js`

## 📊 Analytics

Google Analytics 4 events worden getrackt voor:
- Pagina views
- Filter gebruik
- Marker clicks
- Gemeente clicks
- Locatie gebruik
- Detail panel navigatie

**Actie vereist**: Vervang placeholder GA4 ID

## 🌐 Deployment

De applicatie is geoptimaliseerd voor Replit deployment:
- Automatische HTTPS
- CDN caching
- Global availability
- Service Worker caching

## 🔧 Bekende Issues

1. **Module Import Error**: ES6 imports werken niet zonder module configuratie
2. **Filter Data**: Niet alle filter opties hebben volledige data
3. **Contact Forms**: Zijn placeholders en versturen geen echte emails
4. **Gemeente Filter**: UI aanwezig maar filtering werkt niet volledig

## 🚀 Volgende Stappen

1. Fix ES6 module imports
2. Implementeer volledig werkende filters
3. Configureer contact formulieren
4. Voeg Google Analytics toe
5. Verbeter gemeente filtering
6. Voeg meer sample data toe

## 🐛 Debugging

Console logs zijn beschikbaar voor:
- Data loading status
- Geocoding results
- Municipality loading
- Filter applications
- Module loading errors

## 📄 Licentie

Copyright © 2024 Healthy Building Movement
