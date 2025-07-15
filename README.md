# HBM Opportunity Map (Kansenkaart)

Een interactieve kaart applicatie voor het Healthy Building Movement (HBM) project, ontwikkeld voor de Euregio grensoverschrijdende samenwerking tussen Nederlandse en Duitse gemeenten.

## Features

### 🗺️ Kaart Functionaliteit
- **Interactieve kaart** met Leaflet.js
- **Verschillende kaartlagen**: Straat- en satellietweergave
- **Marker clustering** voor optimale performance
- **Hover labels** bij markers en gemeentegrenzen
- **Gemeentegrenzen laag** (Interreg-gemeenten) met Nederlandse en Duitse gemeenten
- **Custom markers** met projectspecifieke iconen en logo's
- **Popup navigatie** tussen resultaten
- **"Alles in beeld"** functie om alle gefilterde resultaten te tonen
- **Zoom en pan** functionaliteit

### 🔍 Filter & Zoek Functionaliteit
- **Geavanceerde filters** met categorieën:
  - Type project (Haalbaarheidsstudie, Ontwerp, Renovatie, etc.)
  - Organisatietype (Architect, Bouwbedrijf, Ingenieursbureau, etc.)
  - Vakgebied (Architectuur, Bouwservices, Elektrotechniek, etc.)
  - HBM Thema's (Akoestiek, Binnenluchtkwaliteit, Licht, etc.)
  - HBM Kenmerken (Biobased materialen, Circulair, Passiefhuis, etc.)
  - HBM Sectoren (Onderwijs, Zorg, Wonen, Kantoor, etc.)
  - Gemeenten (Nederlandse en Duitse gemeenten)

- **Object type filtering**: Projecten, Bedrijven, Experts
- **Tekst zoekfunctie** in naam en beschrijving
- **Locatie-gebaseerd filteren** met GPS functionaliteit
- **Afstand filter** met instelbare radius (1-100 km)
- **Filter combinatie modi**: EN/OF logica
- **Selecteer alles/geen** knoppen voor snelle selectie
- **Gemeente specifieke selectie knoppen** (NL/DE/Alle/Geen)

### 💾 Filter Beheer
- **Opslaan van filters** met custom namen
- **Laden van opgeslagen filters**
- **Verwijderen van opgeslagen filters**
- **Filter teller** in options menu
- **Laatste filter notificatie** bij terugkeer naar kaart
- **URL state management** voor filter delen
- **Filter geschiedenis** tracking

### 📱 User Interface
- **Responsive design** voor desktop, tablet en mobiel
- **Hamburger menu** voor mobiele navigatie
- **Tab interface** (Projecten, Bedrijven, Experts)
- **List/kaart toggle** op mobiele apparaten
- **Detail panels** met navigatie tussen items
- **Export functionaliteit** naar CSV
- **Deel functionaliteit** via URL
- **Loading states** en error handling

### 🌍 Meertaligheid & Toegankelijkheid
- **Nederlandse interface** (primair)
- **Aria labels** voor screen readers
- **Keyboard navigatie** ondersteuning
- **Error fallbacks** voor ontbrekende data
- **Graceful degradation** bij API failures

### 📊 Data & Performance
- **Geocoding** voor ontbrekende coördinaten via OpenStreetMap
- **Caching** met versioning systeem
- **Performance monitoring** met Google Analytics 4
- **Batch marker creation** voor snelle rendering
- **Lazy loading** van gemeente boundaries
- **Client-side filtering** voor snelle response

### 🏛️ Template Structuur
- **Gedeelde header/footer** componenten
- **Consistent styling** over alle pagina's
- **Interreg branding** integratie
- **Navigation consistency** tussen pagina's

## Technische Specificaties

### Frontend Stack
- **HTML5/CSS3/JavaScript** (Vanilla)
- **Leaflet.js** voor kaart functionaliteit
- **Leaflet.markercluster** voor marker clustering
- **OpenStreetMap** tiles en geocoding
- **Google Analytics 4** voor tracking

### Data Formaten
- **GeoJSON** voor gemeente boundaries
- **JSON** voor filter configuratie en data
- **CSV export** functionaliteit
- **LocalStorage** voor user preferences

### Performance Features
- **Aggressive caching** met cache busting
- **Version control** voor assets
- **Batch operations** voor DOM manipulatie
- **Debounced search** input
- **Lazy loading** van niet-kritieke componenten

## Bestandsstructuur

```
├── config/
│   ├── map-config.js    # Kaart configuratie
│   ├── version.js       # Versie management
│   └── utils.js         # Utility functies
├── data/
│   ├── geojson/         # Gemeente boundary data
│   ├── filters.json     # Filter configuratie
│   ├── municipalities.json # Gemeente informatie
│   └── opportunities.json   # Project/bedrijf data
├── icons/               # SVG iconen voor UI
├── images/              # Logo's en afbeeldingen
├── translations/        # Meertalige content
├── index.html           # Hoofd kaart pagina
├── info.html           # Informatie pagina
├── over.html           # Over HBM pagina
├── contact.html        # Contact pagina
├── script.js           # Hoofd JavaScript functionaliteit
└── style.css           # Styling en responsive design
```

## Browser Ondersteuning
- **Chrome/Edge**: Volledig ondersteund
- **Firefox**: Volledig ondersteund  
- **Safari**: Volledig ondersteund
- **Mobiele browsers**: Responsive design

## Development Setup
1. Clone repository
2. Gebruik `npx serve . -l 5000` voor local development
3. Wijzig `config/version.js` voor cache busting bij updates

## Deployment
- **Statische hosting** compatible
- **Replit deployment** ready
- **CDN friendly** met versioning

## Maintenance
- **Modulaire opbouw** voor eenvoudige updates
- **Configuratie bestanden** voor data management
- **Version tracking** voor change management
- **Error logging** voor debugging
- **Performance monitoring** ingebouwd

## Future Enhancements
- Offline functionaliteit met Service Worker
- Meer talen ondersteuning
- Advanced filtering algoritmes
- Real-time data updates
- Enhanced accessibility features