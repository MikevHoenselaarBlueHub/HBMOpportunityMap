
# HBM Kansenkaart - Gezond Bouwen en Leren Platform

Een interactieve kaartapplicatie voor het Healthy Building Materials (HBM) project, ontwikkeld in het kader van het Interreg Nederland-Deutschland programma. Het platform verbindt Nederlandse en Duitse organisaties die werken aan gezond bouwen en faciliteert kennisdeling en samenwerking.

## 🚀 Functionaliteiten

### Hoofdapplicatie
- **Interactieve kaart**: Overzicht van projecten en bedrijven in Nederland en Duitsland
- **Geavanceerde filters**: Zoeken op organisatietype, sector, HBM-onderwerpen en kenmerken
- **Detailweergave**: Uitgebreide informatie per kans inclusief contactgegevens
- **Responsive design**: Optimaal werkend op desktop, tablet en mobiel
- **Meertalig**: Nederlands, Duits en Engels
- **Marker clustering**: Automatische groepering van nabijgelegen markers

### Admin CMS
- **Gebruikersbeheer**: Admin en Editor rollen met specifieke rechten
- **Kansen beheer**: 
  - Toevoegen, bewerken en verwijderen van kansen
  - Filter assignment per kans
  - Logo upload functionaliteit
  - Coördinaten selecteren via kaart
  - Excel import functionaliteit
- **Filter beheer**: Beheer van alle filtercategorieën
- **Gemeenten beheer**: 
  - Database beheer van gemeenten
  - Zichtbaarheid configuratie via interactieve kaart
  - Automatische GeoJSON generatie
- **Data import**: XLS/XLSX bestanden importeren met automatische validatie
- **Backup systeem**: Automatische backups bij wijzigingen

## 📁 Projectstructuur

```
hbm-kansenkaart/
├── admin/                    # Admin CMS bestanden
│   ├── admin-scripts.js     # Admin functionaliteit
│   ├── admin-styles.css     # Admin styling
│   ├── dashboard.html       # Admin dashboard
│   └── index.html          # Admin login
├── data/                    # Data bestanden
│   ├── geojson/            # GeoJSON bestanden voor kaartvisualisatie
│   ├── opportunities.json  # Kansen data
│   ├── filters.json        # Filter categorieën
│   └── municipalities.json # Gemeenten data
├── database/               # Database management
│   ├── db-manager.js      # Database operaties
│   └── users.json         # Gebruikers database
├── uploads/               # Geüploade bestanden
│   └── logos/            # Logo uploads
├── scripts/              # Frontend JavaScript
├── icons/               # SVG iconen
├── images/              # Afbeeldingen en logo's
├── translations/        # Meertalige ondersteuning
├── config/             # Configuratie bestanden
├── backup/             # Automatische backups
├── server.js           # Express server
└── index.html         # Hoofdapplicatie
```

## 🛠 Installatie en Setup

### Vereisten
- Node.js (v14 of hoger)
- NPM

### Lokale ontwikkeling

1. **Dependencies installeren**:
```bash
npm install
```

2. **Server starten**:
```bash
node server.js
```

3. **Toegang**:
   - Hoofdapplicatie: `http://localhost:5000`
   - Admin CMS: `http://localhost:5000/admin`

### Eerste keer setup

1. **Admin gebruiker aanmaken**:
   Gebruik het hash-password.js script om een wachtwoord hash te genereren en voeg handmatig een admin gebruiker toe aan `database/users.json`.

2. **Data importeren**:
   - Upload gemeenten data via het admin panel
   - Importeer kansen via Excel upload functionaliteit
   - Configureer filter categorieën

## 🔐 Gebruikersrollen

### Administrator
- Volledige toegang tot alle functies
- Gebruikersbeheer
- Systeeminstellingen
- Data export/import
- Gemeenten zichtbaarheid configuratie

### Editor
- Kansen beheer (toevoegen, bewerken, verwijderen)
- Filter beheer
- Gemeenten gegevens beheer
- Dashboard statistieken

## 📊 Data Management

### Kansen (Opportunities)
Elke kans bevat:
- Basisinformatie (naam, type, beschrijving)
- Locatiegegevens (adres, coördinaten, gemeente)
- Organisatie informatie (type, sector, contactgegevens)
- HBM classificatie (onderwerpen, kenmerken)
- Logo en afbeeldingen
- Gebruik status (external/internal/both)

### Filters
Hiërarchische filterstructuur:
- **ProjectType**: Projectfasen
- **OrganizationType**: Organisatietypes
- **OrganizationField**: Vakgebieden
- **HBMTopic**: Gezond bouwen onderwerpen
- **HBMCharacteristics**: Specifieke kenmerken
- **HBMSector**: Marktsectoren

### Gemeenten
- Nederlandse en Duitse gemeenten
- Zichtbaarheid configuratie
- GeoJSON integratie voor kaartweergave
- Automatische coördinaten ondersteuning

## 🔄 Excel Import

Het systeem ondersteunt Excel import met:
- Automatische validatie van verplichte velden
- Status filtering (alleen 'Approved' records)
- Automatische vertaling Engels naar Nederlands
- Geocoding van adressen naar coördinaten
- Duplicate detectie en update functionaliteit
- Progress tracking en error reporting

### Excel bestand formaat
| Kolom | Veld | Verplicht | Opmerking |
|-------|------|-----------|-----------|
| A | Status | Ja | Moet 'Approved' zijn |
| B | Name | Ja | Unieke identifier |
| C | Address | Nee | Voor geocoding |
| D | PostalCode | Nee | |
| E | City | Nee | |
| F | Country | Nee | NL/DE |
| G | Municipality | Nee | |
| H | OrganizationType | Nee | Komma-gescheiden |
| I | ProjectType | Nee | Komma-gescheiden |
| J | ProjectPhase | Nee | |
| K | HBMUse | Nee | external/internal/both |
| L | HBMType | Ja | Project/Bedrijf |

## 🚀 Deployment

### Replit Deployment
1. Project uploaden naar Replit
2. Dependencies worden automatisch geïnstalleerd
3. Server start automatisch op poort 5000
4. SSL wordt automatisch geconfigureerd

### Productie configuratie
- JWT secret configureren via environment variables
- Rate limiting ingeschakeld
- Security headers actief
- Backup systeem automatisch actief

## 🔧 Technische Details

### Backend (Node.js/Express)
- **Authentication**: JWT tokens met role-based access
- **Security**: Rate limiting, input sanitization, CORS
- **File uploads**: Multer voor logo uploads
- **Database**: JSON-based met automatic backups
- **API**: RESTful endpoints voor alle operaties

### Frontend
- **Mapping**: Leaflet.js met marker clustering
- **UI**: Responsive CSS met mobile-first design
- **JavaScript**: Vanilla JS, geen frameworks
- **Internationalization**: JSON-based translations
- **Progressive Enhancement**: Werkt zonder JavaScript

### Data Flow
1. **Import**: Excel → Validation → Translation → Geocoding → Storage
2. **Display**: Database → API → Filter → Map Visualization
3. **Admin**: CMS → Validation → Backup → Database Update

## 📋 API Endpoints

### Public API
- `GET /api/opportunities` - Haal alle zichtbare kansen op
- `GET /api/filters` - Haal filter categorieën op
- `GET /api/municipalities` - Haal gemeenten data op

### Admin API (Authenticated)
- `POST /admin/api/login` - Authenticatie
- `GET/POST/PUT/DELETE /admin/api/opportunities` - Kansen beheer
- `GET/POST/PUT/DELETE /admin/api/filters` - Filter beheer
- `GET/POST/PUT/DELETE /admin/api/municipalities` - Gemeenten beheer
- `GET/POST/PUT/DELETE /admin/api/users` - Gebruikersbeheer
- `POST /admin/api/upload-logo` - Logo upload

## 🔍 Troubleshooting

### Veelvoorkomende problemen

1. **Login werkt niet**:
   - Controleer JWT_SECRET environment variable
   - Verificeer gebruiker in database/users.json

2. **Excel import faalt**:
   - Controleer bestandsformaat (.xlsx/.xls)
   - Verificeer dat eerste kolom 'Status' bevat
   - Controleer op 'Approved' records

3. **Kaart laadt niet**:
   - Controleer internetverbinding (Leaflet CDN)
   - Verificeer opportunities.json format
   - Check browser console voor errors

4. **Logo upload werkt niet**:
   - Controleer bestandsgrootte (max 5MB)
   - Verificeer bestandstype (alleen afbeeldingen)
   - Check uploads/ directory permissions

## 📈 Monitoring en Maintenance

### Logging
- Server logs alle belangrijke operaties
- Error tracking voor debugging
- User action logging voor audit trail

### Backups
- Automatische backups bij elke wijziging
- Timestamped backup files in backup/ directory
- Manual backup functionaliteit in admin panel

### Performance
- Marker clustering voor grote datasets
- Lazy loading van afbeeldingen
- Optimized JSON responses
- CDN voor externe resources

## 🤝 Contributing

Voor bijdragen aan het project:
1. Fork het project
2. Maak een feature branch
3. Test grondig in verschillende browsers
4. Submit een pull request met duidelijke beschrijving

## 📞 Support

Voor vragen of support, neem contact op met het ontwikkelteam of raadpleeg de documentatie in de `/docs` directory.

## 📄 Licentie

Dit project is onderdeel van het Interreg Nederland-Deutschland programma en valt onder de EU regelgeving voor grensoverschrijdende projecten.
