
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const rateLimit = require("express-rate-limit");

const app = express();

// Trust proxy voor Replit environment
app.set('trust proxy', true);

// Rate limiting
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { success: false, message: "Te veel login pogingen. Probeer het later opnieuw." },
    standardHeaders: true,
    legacyHeaders: false,
});

const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
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
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';");
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

// Gebruikers database
const users = [
    {
        id: 1,
        username: "admin",
        password: "$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi", // password
        email: "mike@bluehub.nl",
        role: "admin",
        created: new Date("2024-01-01"),
    },
    {
        id: 2,
        username: "editor",
        password: "$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi", // password
        email: "info@healthybuildingmovement.com",
        role: "editor",
        created: new Date("2024-01-15"),
    },
];

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

    const user = users.find((u) => u.username === username);
    if (!user) {
        console.log(`[LOGIN] Fout: Gebruiker ${username} niet gevonden`);
        return res.status(401).json({ success: false, message: "Ongeldige inloggegevens" });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
        console.log(`[LOGIN] Fout: Ongeldig wachtwoord voor gebruiker ${username}`);
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
});

app.get("/admin/api/users", authenticateToken, (req, res) => {
    console.log(`[USERS] Gebruikerslijst opgevraagd door: ${req.user.username}`);
    const userList = users.map((user) => ({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        created: user.created,
    }));
    res.json(userList);
});

// Nieuwe gebruiker aanmaken
app.post("/admin/api/users", authenticateToken, async (req, res) => {
    const { username, email, password, role } = req.body;
    console.log(`[CREATE_USER] Poging tot aanmaken nieuwe gebruiker door: ${req.user.username}`);
    console.log(`[CREATE_USER] Data ontvangen:`, { username, email, role, password: password ? '[VERBORGEN]' : 'LEEG' });

    try {
        // Validatie
        if (!username || !email || !password || !role) {
            console.log(`[CREATE_USER] Fout: Ontbrekende vereiste velden`);
            return res.status(400).json({
                success: false,
                message: "Alle velden zijn vereist: username, email, password, role"
            });
        }

        // Check of gebruiker al bestaat
        const existingUser = users.find(u => u.username === username || u.email === email);
        if (existingUser) {
            console.log(`[CREATE_USER] Fout: Gebruiker bestaat al - ${existingUser.username === username ? 'username' : 'email'}`);
            return res.status(409).json({
                success: false,
                message: "Gebruiker met deze gebruikersnaam of email bestaat al"
            });
        }

        // Valideer rol
        const validRoles = ['admin', 'editor'];
        if (!validRoles.includes(role)) {
            console.log(`[CREATE_USER] Fout: Ongeldige rol: ${role}`);
            return res.status(400).json({
                success: false,
                message: "Ongeldige rol. Gebruik 'admin' of 'editor'"
            });
        }

        // Hash wachtwoord
        console.log(`[CREATE_USER] Bezig met hashen van wachtwoord...`);
        const hashedPassword = await bcrypt.hash(password, 10);
        console.log(`[CREATE_USER] Wachtwoord succesvol gehashed`);

        // Nieuwe gebruiker aanmaken
        const newUser = {
            id: Math.max(...users.map(u => u.id)) + 1,
            username,
            email,
            password: hashedPassword,
            role,
            created: new Date()
        };

        users.push(newUser);
        console.log(`[CREATE_USER] Nieuwe gebruiker succesvol aangemaakt: ${username} (ID: ${newUser.id})`);

        // Stuur response zonder wachtwoord
        const userResponse = {
            id: newUser.id,
            username: newUser.username,
            email: newUser.email,
            role: newUser.role,
            created: newUser.created
        };

        res.status(201).json({
            success: true,
            message: "Gebruiker succesvol aangemaakt",
            user: userResponse
        });

    } catch (error) {
        console.error(`[CREATE_USER] Server fout bij aanmaken gebruiker:`, error);
        res.status(500).json({
            success: false,
            message: "Server fout bij aanmaken gebruiker"
        });
    }
});

// Gebruiker bijwerken
app.put("/admin/api/users/:id", authenticateToken, async (req, res) => {
    const userId = parseInt(req.params.id);
    const { username, email, password, role } = req.body;
    console.log(`[UPDATE_USER] Poging tot bijwerken gebruiker ${userId} door: ${req.user.username}`);

    try {
        const userIndex = users.findIndex(u => u.id === userId);
        if (userIndex === -1) {
            console.log(`[UPDATE_USER] Fout: Gebruiker ${userId} niet gevonden`);
            return res.status(404).json({
                success: false,
                message: "Gebruiker niet gevonden"
            });
        }

        const user = users[userIndex];
        
        // Update velden
        if (username) user.username = username;
        if (email) user.email = email;
        if (role) user.role = role;
        if (password) {
            console.log(`[UPDATE_USER] Bijwerken wachtwoord voor gebruiker ${userId}`);
            user.password = await bcrypt.hash(password, 10);
        }

        console.log(`[UPDATE_USER] Gebruiker ${userId} succesvol bijgewerkt`);

        const userResponse = {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            created: user.created
        };

        res.json({
            success: true,
            message: "Gebruiker succesvol bijgewerkt",
            user: userResponse
        });

    } catch (error) {
        console.error(`[UPDATE_USER] Server fout bij bijwerken gebruiker ${userId}:`, error);
        res.status(500).json({
            success: false,
            message: "Server fout bij bijwerken gebruiker"
        });
    }
});

// Gebruiker verwijderen
app.delete("/admin/api/users/:id", authenticateToken, (req, res) => {
    const userId = parseInt(req.params.id);
    console.log(`[DELETE_USER] Poging tot verwijderen gebruiker ${userId} door: ${req.user.username}`);

    try {
        const userIndex = users.findIndex(u => u.id === userId);
        if (userIndex === -1) {
            console.log(`[DELETE_USER] Fout: Gebruiker ${userId} niet gevonden`);
            return res.status(404).json({
                success: false,
                message: "Gebruiker niet gevonden"
            });
        }

        // Voorkom dat gebruiker zichzelf verwijdert
        if (userId === req.user.id) {
            console.log(`[DELETE_USER] Fout: Gebruiker ${req.user.username} probeert zichzelf te verwijderen`);
            return res.status(400).json({
                success: false,
                message: "Je kunt jezelf niet verwijderen"
            });
        }

        const deletedUser = users.splice(userIndex, 1)[0];
        console.log(`[DELETE_USER] Gebruiker ${deletedUser.username} (${userId}) succesvol verwijderd`);

        res.json({
            success: true,
            message: "Gebruiker succesvol verwijderd"
        });

    } catch (error) {
        console.error(`[DELETE_USER] Server fout bij verwijderen gebruiker ${userId}:`, error);
        res.status(500).json({
            success: false,
            message: "Server fout bij verwijderen gebruiker"
        });
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

// Explicit data routes voor debugging
app.get('/data/opportunities.json', (req, res) => {
    try {
        console.log(`[DATA] Loading opportunities.json`);
        const data = JSON.parse(fs.readFileSync(path.join(__dirname, "data/opportunities.json"), "utf8"));
        console.log(`[DATA] Successfully loaded ${data.length} opportunities`);
        res.json(data);
    } catch (error) {
        console.error(`[DATA] Error loading opportunities.json:`, error);
        res.status(500).json({ error: "Failed to load opportunities data" });
    }
});

app.get('/data/filters.json', (req, res) => {
    try {
        console.log(`[DATA] Loading filters.json`);
        const data = JSON.parse(fs.readFileSync(path.join(__dirname, "data/filters.json"), "utf8"));
        console.log(`[DATA] Successfully loaded filters data`);
        res.json(data);
    } catch (error) {
        console.error(`[DATA] Error loading filters.json:`, error);
        res.status(500).json({ error: "Failed to load filters data" });
    }
});

app.get('/data/municipalities.json', (req, res) => {
    try {
        console.log(`[DATA] Loading municipalities.json`);
        const data = JSON.parse(fs.readFileSync(path.join(__dirname, "data/municipalities.json"), "utf8"));
        console.log(`[DATA] Successfully loaded municipalities data`);
        res.json(data);
    } catch (error) {
        console.error(`[DATA] Error loading municipalities.json:`, error);
        res.status(500).json({ error: "Failed to load municipalities data" });
    }
});

// Request logging middleware for all requests
app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.url}`);
    if (req.url.startsWith('/admin/api/')) {
        console.log(`[API] ${req.method} ${req.url} - User: ${req.user ? req.user.username : 'Niet geauthenticeerd'}`);
    }
    next();
});

// Serve static files voor hoofdapplicatie met specifieke MIME types
app.use(express.static('.', {
    index: 'index.html',
    setHeaders: (res, path) => {
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        } else if (path.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        } else if (path.endsWith('.json')) {
            res.setHeader('Content-Type', 'application/json');
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

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`========================================`);
    console.log(`🚀 Server succesvol gestart op poort ${PORT}`);
    console.log(`📍 Server luistert op: 0.0.0.0:${PORT}`);
    console.log(`🌐 Hoofdapplicatie: https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co/`);
    console.log(`⚙️  Admin CMS: https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co/admin/`);
    console.log(`========================================`);
});
