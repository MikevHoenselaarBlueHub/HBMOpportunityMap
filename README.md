
# HBM Kansenkaart - Interactieve Kaart voor Gezond Bouwen

Een interactieve kaart applicatie die kansen voor gezond bouwen in de Euregio (Nederland en Duitsland) visualiseert. Ontwikkeld voor Healthy Building Movement (HBM).

## 🌟 Nieuwe Functionaliteiten (Recent Toegevoegd)

### UI/UX Verbeteringen
- ✅ **Hover labels**: Markers tonen nu de naam van bedrijf/project bij mouseover
- ✅ **Slimme label positionering**: Labels blijven altijd zichtbaar binnen het kaartgebied
- ✅ **Uniforme marker styling**: Alle markers (met en zonder foto) hebben nu consistente grootte
- ✅ **Witte cirkel markers**: Markers zonder foto krijgen een wit rondje met icoon
- ✅ **Satellietweergave**: Nieuwe kaartlaag met satellieten beelden (aan/uit schakelbaar)

### Filter Systeem
- ✅ **Externe filters.json**: Alle filteropties zijn nu gecentraliseerd in een apart bestand
- ✅ **Klikbare filter links**: In detailpaneel kun je op waardes klikken om direct te filteren
- ✅ **Intelligente filter links**: Links tonen juiste tekst ("bedrijven" of "projecten")
- ✅ **Tab synchronisatie**: Tabs in zijbalk synchroniseren automatisch met URL parameters

### Navigatie Verbeteringen
- ✅ **Popup navigatie**: Pijltjes in popups om naar volgende/vorige marker te gaan
- ✅ **Detailpaneel navigatie**: Navigeer door gefilterde resultaten in detailpaneel
- ✅ **Juiste pijl richting**: Links pijltje wijst naar links, rechts naar rechts
- ✅ **Context-bewuste navigatie**: Navigatie werkt op basis van huidige filterresultaten

### Data Management
- ✅ **Verbeterde geocoding**: Automatische coördinaten voor adressen zonder lat/lng
- ✅ **Betere foutafhandeling**: Robuuste error handling voor ontbrekende data

## 🚀 Bestaande Functionaliteiten

### Kaart Functionaliteiten
- ✅ **Interactieve kaart**: Powered by Leaflet.js met clustering
- ✅ **Dual country support**: Nederland en Duitsland markers
- ✅ **Custom markers**: Onderscheid tussen projecten en bedrijven
- ✅ **Photo markers**: Markers met logo's/afbeeldingen voor visuele herkenning
- ✅ **Gemeente grenzen**: Nederland & Duitsland gemeentegrenzen
- ✅ **Cluster functionaliteit**: Automatische groepering van markers
- ✅ **Responsive design**: Werkt op desktop, tablet en mobiel
- ✅ **Detail panel**: Uitgebreide informatie met navigatie

### Filter Opties
- ✅ **Type organisatie**: Project/Bedrijf toggle
- ✅ **Project types**: Circulair, Frisse Scholen, Nieuwbouw, Renovatie
- ✅ **Organisatie types**: Aannemer, Architect, Installatiebedrijf, etc.
- ✅ **Vakgebieden**: Architectuur, Bouwservices, Modulair, Zonne-energie
- ✅ **HBM onderwerpen**: Akoestiek, Binnenluchtkwaliteit, Licht
- ✅ **Kenmerken**: Biobased materialen, Circulair, Passiefhuis
- ✅ **Sectoren**: Onderwijs, Wonen, Zorg
- ✅ **Locatie + radius filter**: GPS-gebaseerde nabijheidsfiltering
- ✅ **Tekst zoeken**: Zoek in namen en beschrijvingen
- ✅ **Gemeente filters**: Filter op specifieke gemeenten
- ✅ **Opslaan en laden**: Bewaar favoriete filter combinaties
- ✅ **URL state management**: Deel filters via URL
- ✅ **Lijst/kaart toggle**: Schakel tussen kaart en lijst weergave

### Data Management
- ✅ **JSON data structuur**: Flexibele data opslag
- ✅ **GeoJSON gemeente data**: Accurate gemeente grenzen
- ✅ **Automatische geocoding**: Coördinaten voor adressen
- ✅ **Meertalige ondersteuning**: NL/EN/DE support (basis)
- ✅ **Cache management**: Optimale laadtijden

### Performance & UX
- ✅ **Service Worker**: Offline functionaliteit basis
- ✅ **Optimized rendering**: Efficiënte kaart weergave
- ✅ **Progressive loading**: Data wordt incrementeel geladen
- ✅ **Error boundaries**: Graceful error handling
- ✅ **Mobile first**: Mobiel-vriendelijk ontwerp

## ⚠️ Beperkt Werkende Functionaliteiten

### Formulieren & Contact
- ❌ **Contact formulieren**: Placeholder functionaliteit alleen
- ❌ **Formspree/Netlify Forms**: Nog niet geconfigureerd
- ❌ **Email verzending**: Backend integratie ontbreekt

### Analytics & Tracking
- ⚠️ **Google Analytics 4**: Placeholder ID, configuratie vereist
- ❌ **Event tracking**: Basis implementatie, niet volledig getest

### Geavanceerde Features
- ❌ **Export functionaliteit**: UI aanwezig, backend ontbreekt
- ❌ **Print functionaliteit**: Nog niet geïmplementeerd
- ❌ **Deel via social media**: Basis URL delen alleen

## 🛠️ Technische Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6+)
- **Kaart Engine**: Leaflet.js v1.9+ met MarkerCluster plugin
- **Data Formats**: GeoJSON (gemeente grenzen), JSON (opportunities/filters)
- **Offline Support**: Service Worker (basis implementatie)
- **Build Process**: Geen bundler - native ES modules
- **Styling**: Custom CSS met CSS Grid/Flexbox
- **Icons**: SVG icon set voor consistente weergave

## 📁 Project Structuur

```
├── config/               # Configuratie bestanden
│   ├── map-config.js    # Kaart instellingen
│   ├── utils.js         # Utility functies
│   └── version.js       # Versie management
├── data/                # Data bestanden
│   ├── geojson/         # Gemeente grenzen
│   ├── filters.json     # Filter opties
│   └── opportunities.json # Kaart data
├── icons/               # SVG iconen
├── translations/        # Meertalige ondersteuning
├── index.html          # Hoofd pagina
├── script.js           # Hoofd JavaScript
├── style.css           # Styling
└── sw.js               # Service Worker
```

## 🔧 Installatie & Gebruik

1. **Clone repository**:
   ```bash
   git clone [repository-url]
   cd hbm-kansenkaart
   ```

2. **Start development server**:
   ```bash
   npx serve . -l 5000
   ```

3. **Open browser**:
   Ga naar `http://localhost:5000`

## 🚦 Development Workflow

### Data Updates
- **Opportunities**: Edit `data/opportunities.json`
- **Filters**: Edit `data/filters.json`
- **Translations**: Edit files in `translations/`

### Styling Changes
- **Main styles**: Edit `style.css`
- **Responsive**: Mobile-first approach implemented

### New Features
- **Add to script.js**: Main application logic
- **Update config/**: For configuration changes
- **Test on mobile**: Responsive design is priority

## 📊 Data Formaat

### Opportunities Data
```json
{
  "Name": "Project Naam",
  "HBMType": "Project|Bedrijf",
  "ProjectType": ["Circulair", "Renovatie"],
  "OrganizationType": "Aannemer",
  "OrganizationField": ["Architectuur"],
  "HBMTopic": ["Binnenluchtkwaliteit"],
  "HBMCharacteristics": ["Circulair"],
  "HBMSector": "Wonen",
  "Description": "Beschrijving...",
  "Latitude": 51.2345,
  "Longitude": 5.6789,
  "Municipality": "Gemeente naam",
  "Country": "Netherlands|Germany"
}
```

### Filter Configuration
```json
{
  "ProjectType": ["Circulair", "Frisse Scholen"],
  "OrganizationType": ["Aannemer", "Architect"],
  "HBMSector": ["Onderwijs", "Wonen", "Zorg"]
}
```

## 🔮 Toekomstige Ontwikkelingen

### Prioriteit Hoog
- [ ] **Contact formulier backend**: Werkende contact integratie
- [ ] **Analytics configuratie**: Google Analytics 4 setup
- [ ] **Export functionaliteit**: CSV/PDF export van resultaten

### Prioriteit Medium
- [ ] **Admin panel**: CMS voor data beheer
- [ ] **User accounts**: Persoonlijke favorieten
- [ ] **Advanced search**: Fuzzy search, filters combineren

### Prioriteit Laag
- [ ] **Mobile app**: PWA naar native app
- [ ] **API development**: REST API voor externe integraties
- [ ] **Machine learning**: Slimme aanbevelingen

## 🤝 Contributing

1. **Fork** het project
2. **Create feature branch**: `git checkout -b feature/AmazingFeature`
3. **Commit changes**: `git commit -m 'Add AmazingFeature'`
4. **Push to branch**: `git push origin feature/AmazingFeature`
5. **Open Pull Request**

## 📄 License

Dit project is ontwikkeld voor Healthy Building Movement (HBM).

## 🆘 Support

Voor vragen of support:
- **Email**: [contact email]
- **Documentation**: Deze README
- **Issues**: GitHub Issues sectie

---

**Laatste update**: 15 januari 2025
**Versie**: 2.1.0
**Status**: ✅ Production Ready (met beperkte backend functionaliteiten)
