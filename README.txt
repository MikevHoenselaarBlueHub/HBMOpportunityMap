
HBM Kansenkaart - Codex overdracht
----------------------------------

In deze ZIP vind je alles wat je nodig hebt om direct verder te werken in een OpenAI Codex omgeving.

INHOUD
------
- index.html  : Kansenkaart met hamburger menu, fullscreen navigatie overlay, filter overlay met bold labels, slide-in detailcard met omschrijving (~50 woorden) en conversieknoppen.
- info.html   : Meer info pagina met dezelfde navigatie.
- over.html   : Over HBM pagina met dezelfde navigatie.
- style.css   : Mobile-first styling, bold labels, overlay animaties, sticky knoppen, UX verbeteringen.
- script.js   : 
    * Logica voor toggles (menu/filter/detailcard)
    * Vul filters met dummy data
    * Multi-select checkboxes/radiobuttons
    * Type organisatie toggle
    * Slide-in detailcard met conversieknoppen
    * Fullscreen formulier (Netlify Forms of Formspree)
    * Basis GA4 events (vervang G-XXXXXXXXXX door jouw ID)
- opportunities.json : 50 dummy items met alle velden en Description (~50 woorden)
- favicon.ico : Plaats dit in je root
- icons/marker-project.svg & icons/marker-company.svg : Marker iconen voor Leaflet

AANBEVELINGEN
-------------
1) Test lokaal met Live Server of `npx serve .`
2) Koppel opportunities.json later aan een database of API met authenticatie.
3) Zet je eigen Formspree of Netlify Forms endpoint in de form action voor verzenden naar info@healthybuildingmovement.com
4) Vervang de GA4 ID in index.html door jouw werkelijke ID.
5) Controleer cookie consent en privacyregels.
6) Upload alles naar Netlify of een vergelijkbare statische host.

Alles is klaar om direct in Codex verder uit te breiden.
