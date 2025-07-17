
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const rateLimit = require("express-rate-limit");
const DatabaseManager = require("./database/db-manager");

const app = express();
const db = new DatabaseManager();

// Trust proxy voor Replit environment - maar specifiek configureren
app.set('trust proxy', ['127.0.0.1', '::1']);

// Rate limiting met betere proxy configuratie
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { success: false, message: "Te veel login pogingen. Probeer het later opnieuw." },
    standardHeaders: true,
    legacyHeaders: false,
    trustProxy: false, // Explicitief uitschakelen voor deze limiter
});

const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    trustProxy: false, // Explicitief uitschakelen voor deze limiter
});

app.use(generalLimiter);

// Middleware
app.use(express.json({ limit: '10mb' }));

// Security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', 
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://www.googletagmanager.com https://nominatim.openstreetmap.org; " +
        "style-src 'self' 'unsafe-inline' https://unpkg.com https://fonts.googleapis.com; " +
        "img-src 'self' data: blob: https: http:; " +
        "connect-src 'self' https://unpkg.com https://nominatim.openstreetmap.org https://www.googletagmanager.com; " +
        "font-src 'self' https://fonts.gstatic.com; " +
        "object-src 'none'; " +
        "base-uri 'self';"
    );
    next();
});

// Input sanitatie
function sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    return input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/javascript:/gi, '')
                .trim();
}

function validateInput(req, res, next) {
    if (req.body) {
        for (const key in req.body) {
            if (typeof req.body[key] === 'string') {
                req.body[key] = sanitizeInput(req.body[key]);
            }
        }
    }
    next();
}

app.use(validateInput);

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || "hbm-admin-secret-key-2024";

// JWT verificatie middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({ error: "Access token required" });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: "Invalid token" });
        }
        req.user = user;
        next();
    });
};

// === ADMIN ROUTES ===

// Admin static files
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// Admin API routes
app.post("/admin/api/login", loginLimiter, async (req, res) => {
    const { username, password } = req.body;
    console.log(`[LOGIN] Poging tot inloggen voor gebruiker: ${username}`);

    if (!username || !password) {
        console.log(`[LOGIN] Fout: Ontbrekende inloggegevens voor ${username}`);
        return res.status(400).json({
            success: false,
            message: "Gebruikersnaam en wachtwoord zijn vereist",
        });
    }

    try {
        const user = await db.validatePassword(username, password);
        if (!user) {
            console.log(`[LOGIN] Fout: Ongeldige inloggegevens voor ${username}`);
            return res.status(401).json({ success: false, message: "Ongeldige inloggegevens" });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: "8h" },
        );

        console.log(`[LOGIN] Succesvol ingelogd: ${username} (${user.role})`);
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
            },
        });
    } catch (error) {
        console.error(`[LOGIN] Database error:`, error);
        res.status(500).json({ success: false, message: "Server fout" });
    }
});

app.get("/admin/api/users", authenticateToken, (req, res) => {
    console.log(`[USERS] Gebruikerslijst opgevraagd door: ${req.user.username}`);
    try {
        const userList = db.getAllUsers();
        res.json(userList);
    } catch (error) {
        console.error(`[USERS] Database error:`, error);
        res.status(500).json({ error: "Fout bij laden van gebruikers" });
    }
});

// Nieuwe gebruiker aanmaken
app.post("/admin/api/users", authenticateToken, async (req, res) => {
    const { username, email, password, role } = req.body;
    console.log(`[CREATE_USER] Poging tot aanmaken nieuwe gebruiker door: ${req.user.username}`);
    console.log(`[CREATE_USER] Data ontvangen:`, { username, email, role, password: password ? '[VERBORGEN]' : 'LEEG' });

    try {
        const newUser = await db.createUser({ username, email, password, role });
        
        res.status(201).json({
            success: true,
            message: "Gebruiker succesvol aangemaakt",
            user: newUser
        });

    } catch (error) {
        console.error(`[CREATE_USER] Fout bij aanmaken gebruiker:`, error);
        
        if (error.message.includes('bestaat al') || error.message.includes('Ongeldige rol') || error.message.includes('vereist')) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        } else {
            res.status(500).json({
                success: false,
                message: "Server fout bij aanmaken gebruiker"
            });
        }
    }
});

// Gebruiker bijwerken
app.put("/admin/api/users/:id", authenticateToken, async (req, res) => {
    const userId = parseInt(req.params.id);
    const { username, email, password, role } = req.body;
    console.log(`[UPDATE_USER] Poging tot bijwerken gebruiker ${userId} door: ${req.user.username}`);

    try {
        const updatedUser = await db.updateUser(userId, { username, email, password, role });
        
        res.json({
            success: true,
            message: "Gebruiker succesvol bijgewerkt",
            user: updatedUser
        });

    } catch (error) {
        console.error(`[UPDATE_USER] Fout bij bijwerken gebruiker ${userId}:`, error);
        
        if (error.message.includes('niet gevonden')) {
            res.status(404).json({
                success: false,
                message: error.message
            });
        } else if (error.message.includes('in gebruik') || error.message.includes('Ongeldige rol')) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        } else {
            res.status(500).json({
                success: false,
                message: "Server fout bij bijwerken gebruiker"
            });
        }
    }
});

// Gebruiker verwijderen
app.delete("/admin/api/users/:id", authenticateToken, (req, res) => {
    const userId = parseInt(req.params.id);
    console.log(`[DELETE_USER] Poging tot verwijderen gebruiker ${userId} door: ${req.user.username}`);

    try {
        // Voorkom dat gebruiker zichzelf verwijdert
        if (userId === req.user.id) {
            console.log(`[DELETE_USER] Fout: Gebruiker ${req.user.username} probeert zichzelf te verwijderen`);
            return res.status(400).json({
                success: false,
                message: "Je kunt jezelf niet verwijderen"
            });
        }

        const success = db.deleteUser(userId);
        
        if (success) {
            res.json({
                success: true,
                message: "Gebruiker succesvol verwijderd"
            });
        } else {
            res.status(500).json({
                success: false,
                message: "Fout bij verwijderen van gebruiker"
            });
        }

    } catch (error) {
        console.error(`[DELETE_USER] Fout bij verwijderen gebruiker ${userId}:`, error);
        
        if (error.message.includes('niet gevonden')) {
            res.status(404).json({
                success: false,
                message: error.message
            });
        } else {
            res.status(500).json({
                success: false,
                message: "Server fout bij verwijderen gebruiker"
            });
        }
    }
});

app.get("/admin/api/opportunities", authenticateToken, (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(path.join(__dirname, "data/opportunities.json"), "utf8"));
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Fout bij het laden van data" });
    }
});

app.post("/admin/api/opportunities", authenticateToken, (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(path.join(__dirname, "data/opportunities.json"), "utf8"));
        const newOpportunity = {
            ...req.body,
            id: Date.now().toString(),
        };
        data.push(newOpportunity);
        fs.writeFileSync(path.join(__dirname, "data/opportunities.json"), JSON.stringify(data, null, 2));
        res.status(201).json(newOpportunity);
    } catch (error) {
        res.status(500).json({ error: "Fout bij het opslaan van data" });
    }
});

app.put("/admin/api/opportunities/:id", authenticateToken, (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(path.join(__dirname, "data/opportunities.json"), "utf8"));
        const index = data.findIndex((item) => item.Name === req.params.id);
        if (index === -1) {
            return res.status(404).json({ error: "Item niet gevonden" });
        }
        data[index] = { ...data[index], ...req.body };
        fs.writeFileSync(path.join(__dirname, "data/opportunities.json"), JSON.stringify(data, null, 2));
        res.json(data[index]);
    } catch (error) {
        res.status(500).json({ error: "Fout bij het bijwerken van data" });
    }
});

app.delete("/admin/api/opportunities/:id", authenticateToken, (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(path.join(__dirname, "data/opportunities.json"), "utf8"));
        const filteredData = data.filter((item) => item.Name !== req.params.id);
        fs.writeFileSync(path.join(__dirname, "data/opportunities.json"), JSON.stringify(filteredData, null, 2));
        res.json({ message: "Item verwijderd" });
    } catch (error) {
        res.status(500).json({ error: "Fout bij het verwijderen van data" });
    }
});

app.get("/admin/api/filters", authenticateToken, (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(path.join(__dirname, "data/filters.json"), "utf8"));
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Fout bij het laden van filters" });
    }
});

app.get("/admin/api/municipalities", authenticateToken, (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(path.join(__dirname, "data/municipalities.json"), "utf8"));
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Fout bij het laden van gemeenten" });
    }
});

// Municipality management endpoints
app.post("/admin/api/municipalities", authenticateToken, (req, res) => {
    const { name, country, code, population, area, largest_places } = req.body;
    console.log(`[CREATE_MUNICIPALITY] Poging tot aanmaken gemeente door: ${req.user.username}`);

    if (!name || !country || !code) {
        return res.status(400).json({
            success: false,
            message: "Naam, land en code zijn verplichte velden"
        });
    }

    try {
        const municipalitiesPath = path.join(__dirname, "data/municipalities.json");
        const data = JSON.parse(fs.readFileSync(municipalitiesPath, "utf8"));
        
        // Check if municipality already exists
        const existingMunicipality = data.municipalities.find(m => m.name.toLowerCase() === name.toLowerCase());
        if (existingMunicipality) {
            return res.status(400).json({
                success: false,
                message: "Een gemeente met deze naam bestaat al"
            });
        }

        const newMunicipality = {
            name,
            country,
            code,
            population: population ? parseInt(population) : undefined,
            area: area || undefined,
            largest_places: largest_places ? largest_places.split(',').map(p => p.trim()) : undefined
        };

        // Remove undefined fields
        Object.keys(newMunicipality).forEach(key => {
            if (newMunicipality[key] === undefined) {
                delete newMunicipality[key];
            }
        });

        data.municipalities.push(newMunicipality);
        
        // Sort municipalities by name
        data.municipalities.sort((a, b) => a.name.localeCompare(b.name));
        
        fs.writeFileSync(municipalitiesPath, JSON.stringify(data, null, 2));
        
        res.status(201).json({
            success: true,
            message: "Gemeente succesvol toegevoegd",
            municipality: newMunicipality
        });

    } catch (error) {
        console.error(`[CREATE_MUNICIPALITY] Error:`, error);
        res.status(500).json({
            success: false,
            message: "Server fout bij toevoegen gemeente"
        });
    }
});

app.put("/admin/api/municipalities/:name", authenticateToken, (req, res) => {
    const municipalityName = decodeURIComponent(req.params.name);
    const { name, country, code, population, area, largest_places } = req.body;
    console.log(`[UPDATE_MUNICIPALITY] Poging tot bijwerken gemeente ${municipalityName} door: ${req.user.username}`);

    try {
        const municipalitiesPath = path.join(__dirname, "data/municipalities.json");
        const data = JSON.parse(fs.readFileSync(municipalitiesPath, "utf8"));
        
        const municipalityIndex = data.municipalities.findIndex(m => m.name === municipalityName);
        if (municipalityIndex === -1) {
            return res.status(404).json({
                success: false,
                message: "Gemeente niet gevonden"
            });
        }

        // Check if new name conflicts with existing (if name changed)
        if (name && name !== municipalityName) {
            const existingMunicipality = data.municipalities.find(m => m.name.toLowerCase() === name.toLowerCase());
            if (existingMunicipality) {
                return res.status(400).json({
                    success: false,
                    message: "Een gemeente met deze naam bestaat al"
                });
            }
        }

        const updatedMunicipality = {
            name: name || municipalityName,
            country: country || data.municipalities[municipalityIndex].country,
            code: code || data.municipalities[municipalityIndex].code,
            population: population ? parseInt(population) : data.municipalities[municipalityIndex].population,
            area: area || data.municipalities[municipalityIndex].area,
            largest_places: largest_places ? largest_places.split(',').map(p => p.trim()) : data.municipalities[municipalityIndex].largest_places
        };

        // Remove undefined fields
        Object.keys(updatedMunicipality).forEach(key => {
            if (updatedMunicipality[key] === undefined) {
                delete updatedMunicipality[key];
            }
        });

        data.municipalities[municipalityIndex] = updatedMunicipality;
        
        // Sort municipalities by name
        data.municipalities.sort((a, b) => a.name.localeCompare(b.name));
        
        fs.writeFileSync(municipalitiesPath, JSON.stringify(data, null, 2));
        
        res.json({
            success: true,
            message: "Gemeente succesvol bijgewerkt",
            municipality: updatedMunicipality
        });

    } catch (error) {
        console.error(`[UPDATE_MUNICIPALITY] Error:`, error);
        res.status(500).json({
            success: false,
            message: "Server fout bij bijwerken gemeente"
        });
    }
});

app.delete("/admin/api/municipalities/:name", authenticateToken, (req, res) => {
    const municipalityName = decodeURIComponent(req.params.name);
    console.log(`[DELETE_MUNICIPALITY] Poging tot verwijderen gemeente ${municipalityName} door: ${req.user.username}`);

    // Only admins can delete municipalities
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: "Alleen administrators kunnen gemeenten verwijderen"
        });
    }

    try {
        const municipalitiesPath = path.join(__dirname, "data/municipalities.json");
        const data = JSON.parse(fs.readFileSync(municipalitiesPath, "utf8"));
        
        const municipalityIndex = data.municipalities.findIndex(m => m.name === municipalityName);
        if (municipalityIndex === -1) {
            return res.status(404).json({
                success: false,
                message: "Gemeente niet gevonden"
            });
        }

        data.municipalities.splice(municipalityIndex, 1);
        fs.writeFileSync(municipalitiesPath, JSON.stringify(data, null, 2));
        
        res.json({
            success: true,
            message: "Gemeente succesvol verwijderd"
        });

    } catch (error) {
        console.error(`[DELETE_MUNICIPALITY] Error:`, error);
        res.status(500).json({
            success: false,
            message: "Server fout bij verwijderen gemeente"
        });
    }
});

// Filter management endpoints
app.post("/admin/api/filters/:category", authenticateToken, (req, res) => {
    const category = req.params.category;
    const { item } = req.body;
    console.log(`[CREATE_FILTER] Poging tot toevoegen filter item in ${category} door: ${req.user.username}`);

    if (!item || !item.trim()) {
        return res.status(400).json({
            success: false,
            message: "Filter item is verplicht"
        });
    }

    try {
        const filtersPath = path.join(__dirname, "data/filters.json");
        const data = JSON.parse(fs.readFileSync(filtersPath, "utf8"));
        
        if (!data[category]) {
            return res.status(400).json({
                success: false,
                message: "Ongeldige filter categorie"
            });
        }

        const trimmedItem = item.trim();
        
        // Check if item already exists
        if (data[category].includes(trimmedItem)) {
            return res.status(400).json({
                success: false,
                message: "Dit filter item bestaat al"
            });
        }

        data[category].push(trimmedItem);
        data[category].sort();
        
        fs.writeFileSync(filtersPath, JSON.stringify(data, null, 2));
        
        res.status(201).json({
            success: true,
            message: "Filter item succesvol toegevoegd",
            item: trimmedItem
        });

    } catch (error) {
        console.error(`[CREATE_FILTER] Error:`, error);
        res.status(500).json({
            success: false,
            message: "Server fout bij toevoegen filter item"
        });
    }
});

app.put("/admin/api/filters/:category/:item", authenticateToken, (req, res) => {
    const category = req.params.category;
    const oldItem = decodeURIComponent(req.params.item);
    const { item: newItem } = req.body;
    console.log(`[UPDATE_FILTER] Poging tot bijwerken filter item in ${category} door: ${req.user.username}`);

    if (!newItem || !newItem.trim()) {
        return res.status(400).json({
            success: false,
            message: "Nieuw filter item is verplicht"
        });
    }

    try {
        const filtersPath = path.join(__dirname, "data/filters.json");
        const data = JSON.parse(fs.readFileSync(filtersPath, "utf8"));
        
        if (!data[category]) {
            return res.status(400).json({
                success: false,
                message: "Ongeldige filter categorie"
            });
        }

        const itemIndex = data[category].indexOf(oldItem);
        if (itemIndex === -1) {
            return res.status(404).json({
                success: false,
                message: "Filter item niet gevonden"
            });
        }

        const trimmedNewItem = newItem.trim();
        
        // Check if new item already exists (and is not the same as old)
        if (trimmedNewItem !== oldItem && data[category].includes(trimmedNewItem)) {
            return res.status(400).json({
                success: false,
                message: "Een filter item met deze naam bestaat al"
            });
        }

        data[category][itemIndex] = trimmedNewItem;
        data[category].sort();
        
        fs.writeFileSync(filtersPath, JSON.stringify(data, null, 2));
        
        res.json({
            success: true,
            message: "Filter item succesvol bijgewerkt",
            item: trimmedNewItem
        });

    } catch (error) {
        console.error(`[UPDATE_FILTER] Error:`, error);
        res.status(500).json({
            success: false,
            message: "Server fout bij bijwerken filter item"
        });
    }
});

app.delete("/admin/api/filters/:category/:item", authenticateToken, (req, res) => {
    const category = req.params.category;
    const item = decodeURIComponent(req.params.item);
    console.log(`[DELETE_FILTER] Poging tot verwijderen filter item ${item} in ${category} door: ${req.user.username}`);

    try {
        const filtersPath = path.join(__dirname, "data/filters.json");
        const data = JSON.parse(fs.readFileSync(filtersPath, "utf8"));
        
        if (!data[category]) {
            return res.status(400).json({
                success: false,
                message: "Ongeldige filter categorie"
            });
        }

        const itemIndex = data[category].indexOf(item);
        if (itemIndex === -1) {
            return res.status(404).json({
                success: false,
                message: "Filter item niet gevonden"
            });
        }

        data[category].splice(itemIndex, 1);
        fs.writeFileSync(filtersPath, JSON.stringify(data, null, 2));
        
        res.json({
            success: true,
            message: "Filter item succesvol verwijderd"
        });

    } catch (error) {
        console.error(`[DELETE_FILTER] Error:`, error);
        res.status(500).json({
            success: false,
            message: "Server fout bij verwijderen filter item"
        });
    }
});

app.get("/admin/api/stats", authenticateToken, (req, res) => {
    try {
        const opportunities = JSON.parse(fs.readFileSync(path.join(__dirname, "data/opportunities.json"), "utf8"));
        const municipalities = JSON.parse(fs.readFileSync(path.join(__dirname, "data/municipalities.json"), "utf8"));

        const stats = {
            totalOpportunities: opportunities.length,
            totalProjects: opportunities.filter((item) => item.HBMType === "Project").length,
            totalCompanies: opportunities.filter((item) => item.HBMType === "Bedrijf").length,
            totalMunicipalities: municipalities.municipalities.length,
        };

        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: "Fout bij het laden van statistieken" });
    }
});

// Redirect /admin naar login
app.get('/admin', (req, res) => {
    res.redirect('/admin/index.html');
});

// === MAIN APP ROUTES ===

// Data routes MOETEN VOOR static middleware komen voor prioriteit
app.get('/data/opportunities.json', (req, res) => {
    try {
        console.log(`[DATA] Loading opportunities.json for ${req.ip}`);
        const dataPath = path.join(__dirname, "data/opportunities.json");
        
        // Check of bestand bestaat
        if (!fs.existsSync(dataPath)) {
            console.error(`[DATA] File not found: ${dataPath}`);
            return res.status(404).json({ error: "Opportunities data file not found" });
        }
        
        const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
        console.log(`[DATA] Successfully loaded ${data.length} opportunities`);
        
        // Ensure proper headers
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-cache');
        res.json(data);
    } catch (error) {
        console.error(`[DATA] Error loading opportunities.json:`, error);
        res.status(500).json({ error: "Failed to load opportunities data", details: error.message });
    }
});

app.get('/data/filters.json', (req, res) => {
    try {
        console.log(`[DATA] Loading filters.json for ${req.ip}`);
        const dataPath = path.join(__dirname, "data/filters.json");
        
        if (!fs.existsSync(dataPath)) {
            console.error(`[DATA] File not found: ${dataPath}`);
            return res.status(404).json({ error: "Filters data file not found" });
        }
        
        const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
        console.log(`[DATA] Successfully loaded filters data`);
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-cache');
        res.json(data);
    } catch (error) {
        console.error(`[DATA] Error loading filters.json:`, error);
        res.status(500).json({ error: "Failed to load filters data", details: error.message });
    }
});

app.get('/data/municipalities.json', (req, res) => {
    try {
        console.log(`[DATA] Loading municipalities.json for ${req.ip}`);
        const dataPath = path.join(__dirname, "data/municipalities.json");
        
        if (!fs.existsSync(dataPath)) {
            console.error(`[DATA] File not found: ${dataPath}`);
            return res.status(404).json({ error: "Municipalities data file not found" });
        }
        
        const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
        console.log(`[DATA] Successfully loaded municipalities data`);
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-cache');
        res.json(data);
    } catch (error) {
        console.error(`[DATA] Error loading municipalities.json:`, error);
        res.status(500).json({ error: "Failed to load municipalities data", details: error.message });
    }
});

// Algemene data directory route als fallback
app.get('/data/*', (req, res) => {
    try {
        const filePath = path.join(__dirname, req.path);
        console.log(`[DATA] Fallback request for: ${req.path}`);
        
        if (!fs.existsSync(filePath)) {
            console.error(`[DATA] File not found: ${filePath}`);
            return res.status(404).json({ error: "Data file not found" });
        }
        
        // Serve the file with proper content type
        if (req.path.endsWith('.json')) {
            res.setHeader('Content-Type', 'application/json');
        } else if (req.path.endsWith('.geojson')) {
            res.setHeader('Content-Type', 'application/geo+json');
        }
        
        res.setHeader('Cache-Control', 'no-cache');
        res.sendFile(filePath);
    } catch (error) {
        console.error(`[DATA] Error serving file:`, error);
        res.status(500).json({ error: "Failed to serve data file" });
    }
});

// Request logging middleware for all requests
app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.url} from ${req.ip}`);
    if (req.url.startsWith('/admin/api/')) {
        console.log(`[API] ${req.method} ${req.url} - User: ${req.user ? req.user.username : 'Niet geauthenticeerd'}`);
    }
    next();
});

// Serve static files voor hoofdapplicatie - NA data routes voor juiste prioriteit
app.use(express.static('.', {
    index: 'index.html',
    dotfiles: 'ignore',
    etag: false,
    setHeaders: (res, filePath) => {
        // Cache-Control headers
        if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
            res.setHeader('Cache-Control', 'no-cache');
        } else if (filePath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
            res.setHeader('Cache-Control', 'no-cache');
        } else if (filePath.endsWith('.json')) {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Cache-Control', 'no-cache');
        } else if (filePath.endsWith('.svg')) {
            res.setHeader('Content-Type', 'image/svg+xml');
            res.setHeader('Cache-Control', 'public, max-age=86400');
        } else if (filePath.endsWith('.html')) {
            res.setHeader('Content-Type', 'text/html');
            res.setHeader('Cache-Control', 'no-cache');
        }
    }
}));

// Fallback voor SPA routing
app.get('*', (req, res) => {
    // Voorkom dat admin routes hier terechtkomen
    if (req.path.startsWith('/admin')) {
        return res.status(404).send('Admin page not found');
    }
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
    console.error(`[ERROR] ${err.stack}`);
    console.error(`[ERROR] Request: ${req.method} ${req.url}`);
    console.error(`[ERROR] Body:`, req.body);
    res.status(500).json({ error: "Er is een serverfout opgetreden" });
});

// Start server - Fixed port configuration
const PORT = 5000; // Fixed port voor consistentie  
app.listen(PORT, "0.0.0.0", () => {
    const replUrl = process.env.REPLIT_DEV_DOMAIN || `${process.env.REPL_SLUG}-${process.env.REPL_OWNER}.replit.dev`;
    
    console.log(`========================================`);
    console.log(`🚀 Server succesvol gestart op poort ${PORT}`);
    console.log(`📍 Server luistert op: 0.0.0.0:${PORT}`);
    console.log(`🌐 Hoofdapplicatie: https://${replUrl}/`);
    console.log(`⚙️  Admin CMS: https://${replUrl}/admin/`);
    console.log(`🔧 Data API: https://${replUrl}/data/`);
    console.log(`========================================`);
    
    // Log data file status for debugging
    try {
        const opportunitiesData = JSON.parse(fs.readFileSync(path.join(__dirname, "data/opportunities.json"), "utf8"));
        console.log(`✅ Opportunities data loaded: ${opportunitiesData.length} items`);
    } catch (error) {
        console.error(`❌ Error loading opportunities data:`, error.message);
    }
    
    try {
        const filtersData = JSON.parse(fs.readFileSync(path.join(__dirname, "data/filters.json"), "utf8"));
        console.log(`✅ Filters data loaded successfully`);
    } catch (error) {
        console.error(`❌ Error loading filters data:`, error.message);
    }
    
    try {
        const municipalitiesData = JSON.parse(fs.readFileSync(path.join(__dirname, "data/municipalities.json"), "utf8"));
        console.log(`✅ Municipalities data loaded: ${municipalitiesData.municipalities.length} items`);
    } catch (error) {
        console.error(`❌ Error loading municipalities data:`, error.message);
    }
});
