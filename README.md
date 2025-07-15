
# HBM Kansenkaart - Interactieve Kaart voor Gezond Bouwen

Een interactieve kaart applicatie die kansen voor gezond bouwen in de Euregio (Nederland en Duitsland) visualiseert. Ontwikkeld voor Healthy Building Movement (HBM).

## 🌟 Nieuwste Updates (Januari 2025)

### Laatste Verbeteringen
- ✅ **URL State Management**: Filters worden nu correct bijgewerkt in de URL
- ✅ **Conversiegerichte content**: Geen resultaten scherm met contact opties
- ✅ **Nederlandse filterwaarden**: Alle filters zijn volledig vertaald
- ✅ **Verbeterde gebruikersinteractie**: Betere feedback bij lege resultaten

### Recente Functionaliteiten
- ✅ **Hover labels**: Markers tonen nu de naam van bedrijf/project bij mouseover
- ✅ **Slimme label positionering**: Labels blijven altijd zichtbaar binnen het kaartgebied
- ✅ **Uniforme marker styling**: Alle markers (met en zonder foto) hebben nu consistente grootte
- ✅ **Witte cirkel markers**: Markers zonder foto krijgen een wit rondje met icoon
- ✅ **Satellietweergave**: Nieuwe kaartlaag met satellieten beelden (aan/uit schakelbaar)

### Filter Systeem Verbeteringen
- ✅ **Externe filters.json**: Alle filteropties zijn nu gecentraliseerd in een apart bestand
- ✅ **Klikbare filter links**: In detailpaneel kun je op waardes klikken om direct te filteren
- ✅ **Intelligente filter links**: Links tonen juiste tekst ("bedrijven" of "projecten")
- ✅ **Tab synchronisatie**: Tabs in zijbalk synchroniseren automatisch met URL parameters
- ✅ **Opslaan en laden filters**: Bewaar favoriete filter combinaties lokaal

### Navigatie Verbeteringen
- ✅ **Popup navigatie**: Pijltjes in popups om naar volgende/vorige marker te gaan
- ✅ **Detailpaneel navigatie**: Navigeer door gefilterde resultaten in detailpaneel
- ✅ **Juiste pijl richting**: Links pijltje wijst naar links, rechts naar rechts
- ✅ **Context-bewuste navigatie**: Navigatie werkt op basis van huidige filterresultaten

## 🚀 Volledige Functionaliteiten

### Kaart Functionaliteiten
- ✅ **Interactieve kaart**: Powered by Leaflet.js met clustering
- ✅ **Dual country support**: Nederland en Duitsland markers
- ✅ **Custom markers**: Onderscheid tussen projecten en bedrijven
- ✅ **Photo markers**: Markers met logo's/afbeeldingen voor visuele herkenning
- ✅ **Gemeente grenzen**: Nederland & Duitsland gemeentegrenzen (11.000+ gemeenten)
- ✅ **Cluster functionaliteit**: Automatische groepering van markers bij inzoomen
- ✅ **Responsive design**: Volledig geoptimaliseerd voor desktop, tablet en mobiel
- ✅ **Detail panel**: Uitgebreide informatie met navigatie door resultaten

### Geavanceerde Filter Opties
- ✅ **Type organisatie**: Project/Bedrijf toggle met realtime filtering
- ✅ **Project types**: Haalbaarheidsstudie, Ontwerp, Constructie, Renovatie, etc.
- ✅ **Organisatie types**: Architect, Bouwbedrijf, Ingenieursbureau, etc.
- ✅ **Vakgebieden**: Architectuur, Gebouwautomatisering, Modulaire Houtbouw, etc.
- ✅ **HBM onderwerpen**: Akoestiek, Binnenluchtkwaliteit, Licht, Thermisch Comfort
- ✅ **Kenmerken**: Biobased materialen, Circulair, Passiefhuis, BREEAM, WELL
- ✅ **Sectoren**: Onderwijs, Wonen, Zorg, Kantoor, Horeca, Recreatie
- ✅ **Locatie + radius filter**: GPS-gebaseerde nabijheidsfiltering (1-100km)
- ✅ **Tekst zoeken**: Realtime zoek in namen en beschrijvingen
- ✅ **Gemeente filters**: Filter op 11.000+ Nederlandse en Duitse gemeenten
- ✅ **Geavanceerde filters**: EN/OF logica, combinatiemogelijkheden
- ✅ **Filter opslaan/laden**: Lokale opslag van favoriete filter combinaties
- ✅ **URL state management**: Deel filters via URL, browser navigatie ondersteuning

### Data Management & Performance
- ✅ **JSON data structuur**: Flexibele, schaalbare data opslag
- ✅ **GeoJSON gemeente data**: Accurate gemeente grenzen voor beide landen
- ✅ **Automatische geocoding**: Coördinaten voor adressen via OpenStreetMap
- ✅ **Meertalige ondersteuning**: NL/EN/DE support basis geïmplementeerd
- ✅ **Aggressieve cache management**: Optimale laadtijden met versioning
- ✅ **Performance optimalisatie**: Batch marker creation, lazy loading
- ✅ **Error boundaries**: Graceful error handling voor ontbrekende data
- ✅ **Progressive loading**: Data wordt incrementeel geladen

### Gebruikersinterface
- ✅ **Mobile first design**: Prioriteit op mobiele gebruikservaring
- ✅ **Lijst/kaart toggle**: Naadloos schakelen tussen weergaven
- ✅ **Tab systeem**: Gescheiden weergave voor projecten en bedrijven
- ✅ **Dropdown menu's**: Intuïtieve filter interface
- ✅ **Hover feedback**: Directe feedback bij marker interactie
- ✅ **Conversion-focused content**: Strategische call-to-actions bij lege resultaten
- ✅ **Accessibility**: ARIA labels, keyboard navigation support

## ⚠️ Beperkt Werkende Functionaliteiten

### Backend Integraties
- ❌ **Contact formulieren**: Placeholder functionaliteit, geen backend
- ❌ **Email verzending**: Vereist server-side implementatie
- ❌ **User accounts**: Geen authenticatie systeem
- ❌ **Admin panel**: Geen CMS voor data beheer

### Analytics & Tracking
- ⚠️ **Google Analytics 4**: Basis implementatie, configuratie vereist
- ⚠️ **Event tracking**: Basis implementatie, niet volledig getest
- ❌ **Conversion tracking**: Geen uitgebreide funnel tracking

### Export & Sharing
- ✅ **CSV Export**: Werkt voor gefilterde resultaten
- ✅ **URL sharing**: Volledig werkend via URL parameters
- ❌ **PDF Export**: Nog niet geïmplementeerd
- ❌ **Social media sharing**: Basis URL delen alleen

## 🛠️ Technische Stack

### Frontend Technologies
- **Core**: HTML5, CSS3, Vanilla JavaScript (ES6+)
- **Mapping**: Leaflet.js v1.9+ met MarkerCluster plugin
- **Geocoding**: OpenStreetMap Nominatim API
- **Build**: Geen bundler - native ES modules voor snelheid
- **Styling**: Custom CSS met CSS Grid/Flexbox
- **Icons**: Optimized SVG icon set
- **Performance**: Service Worker voor offline support

### Data Formats
- **Opportunities**: JSON format met gestructureerde velden
- **Filters**: Centralized JSON configuration
- **Boundaries**: GeoJSON voor Nederlandse en Duitse gemeenten
- **Translations**: JSON-based i18n system

### Development Tools
- **Server**: npx serve voor development
- **Versioning**: Automatic cache busting system
- **Error Handling**: Comprehensive try/catch implementation
- **Debugging**: Console logging met structured format

## 📁 Project Structuur

```
hbm-kansenkaart/
├── config/                    # Configuratie bestanden
│   ├── map-config.js         # Leaflet kaart instellingen
│   ├── utils.js              # Herbruikbare utility functies
│   └── version.js            # Versie en cache management
├── data/                     # Data bestanden
│   ├── geojson/              # Gemeente grenzen
│   │   ├── nl-gemeenten.geojson  # Nederlandse gemeenten
│   │   └── de-gemeenten.geojson  # Duitse gemeenten
│   ├── filters.json          # Gecentraliseerde filter opties
│   └── opportunities.json    # Kaart data (projecten/bedrijven)
├── icons/                    # SVG iconen
│   ├── arrow-left.svg        # Navigatie iconen
│   ├── arrow-right.svg
│   ├── close.svg
│   ├── filter-setting.svg
│   ├── marker-company.svg    # Kaart markers
│   └── marker-project.svg
├── translations/             # Meertalige ondersteuning
│   ├── nl.json              # Nederlands (primair)
│   ├── en.json              # Engels
│   └── de.json              # Duits
├── contact.html             # Contact pagina
├── info.html                # Informatie pagina
├── over.html                # Over HBM pagina
├── index.html               # Hoofd applicatie
├── script.js                # Hoofd JavaScript logica
├── style.css                # Styling en responsive design
└── sw.js                    # Service Worker
```

## 🔧 Installatie & Development

### Lokale Development
```bash
# Clone repository
git clone [repository-url]
cd hbm-kansenkaart

# Start development server
npx serve . -l 5000

# Open browser
http://localhost:5000
```

### Data Updates
```bash
# Update opportunities
vim data/opportunities.json

# Update filters
vim data/filters.json

# Update translations
vim translations/nl.json
```

### Deployment op Replit
1. **Import project** naar Replit
2. **Run** via "npx serve . -l 5000"
3. **Deploy** via Replit Autoscale Deployments
4. **Configure** domein en SSL via Replit

## 📊 Data Structuur

### Opportunities Format
```json
{
  "Name": "Project/Bedrijf Naam",
  "HBMType": "Project|Bedrijf",
  "ProjectType": ["Renovatie", "Circulair"],
  "OrganizationType": "Architect",
  "OrganizationField": ["Architectuur", "Bouwservices"],
  "HBMTopic": ["Binnenluchtkwaliteit", "Licht"],
  "HBMCharacteristics": ["Passiefhuis", "Circulair"],
  "HBMSector": "Wonen",
  "Description": "Beschrijving...",
  "Logo": "https://example.com/logo.jpg",
  "ProjectImage": "https://example.com/project.jpg",
  "Street": "Straatname 123",
  "Zip": "1234AB",
  "City": "Stad",
  "Municipality": "Gemeente",
  "Country": "Netherlands|Germany",
  "Latitude": 51.2345,
  "Longitude": 5.6789
}
```

### Filter Configuration
```json
{
  "ProjectType": ["Haalbaarheidsstudie / Concept", "Ontwerp"],
  "OrganizationType": ["Architect", "Bouwbedrijf"],
  "HBMTopic": ["Akoestiek", "Binnenluchtkwaliteit"],
  "HBMCharacteristics": ["Biobased materialen", "Circulair"],
  "HBMSector": ["Onderwijs", "Wonen", "Zorg"]
}
```

## 🚀 Toekomstige Ontwikkelingen

### Prioriteit Hoog
- [ ] **Backend integratie**: Contact formulier met email verzending
- [ ] **Analytics configuratie**: Volledige Google Analytics 4 setup
- [ ] **Admin panel**: CMS voor eenvoudig data beheer
- [ ] **User accounts**: Persoonlijke favorieten en instellingen

### Prioriteit Medium
- [ ] **Advanced search**: Fuzzy search, autocomplete verbetering
- [ ] **Export uitbreiding**: PDF rapporten, advanced CSV opties
- [ ] **Offline functionaliteit**: Volledige PWA implementatie
- [ ] **Performance optimalisatie**: Lazy loading, virtual scrolling

### Prioriteit Laag
- [ ] **Mobile app**: PWA naar native app conversie
- [ ] **API development**: REST API voor externe integraties
- [ ] **Machine learning**: Slimme aanbevelingen op basis van gebruik
- [ ] **Multi-tenant**: Ondersteuning voor meerdere organisaties

## 🎯 Gebruiksscenario's

### Voor Beleidsmakers
- Overzicht van gezonde bouwprojecten in gemeente
- Contact met lokale experts en bedrijven
- Inzicht in beschikbare kennis en ervaring

### Voor Bouwprofessionals
- Netwerken met gelijkgesinde professionals
- Inspiratie door succesvolle projecten
- Vinden van samenwerkingspartners

### Voor HBM Organisatie
- Zichtbaarheid van eigen netwerk
- Lead generation voor contact
- Data-driven inzichten in markt

## 🤝 Contributing

### Development Workflow
```bash
# 1. Fork project
git checkout -b feature/amazing-feature

# 2. Make changes
vim script.js
vim style.css

# 3. Test locally
npx serve . -l 5000

# 4. Commit changes
git commit -m 'Add amazing feature'

# 5. Push and PR
git push origin feature/amazing-feature
```

### Code Standards
- **ES6+ JavaScript**: Moderne syntax, geen transpilation
- **Semantic HTML**: Accessibility first approach
- **Mobile-first CSS**: Responsive design prioriteit
- **Progressive Enhancement**: Basis functionaliteit werkt altijd

## 📄 License & Credits

- **Ontwikkeld voor**: Healthy Building Movement (HBM)
- **Mapping**: Leaflet.js open source mapping library
- **Geocoding**: OpenStreetMap Nominatim service
- **Icons**: Custom SVG icon set
- **Gemeente data**: Open data van Nederlandse en Duitse overheden

## 🆘 Support & Contact

- **Technical Issues**: GitHub Issues
- **Feature Requests**: Contact HBM via website
- **Documentation**: Deze README + inline code comments
- **Status**: ✅ Production Ready op Replit

---

**Laatste update**: 15 januari 2025  
**Versie**: 2.2.0  
**Platform**: Replit Autoscale Deployment  
**Status**: ✅ Production Ready met volledige URL state management
