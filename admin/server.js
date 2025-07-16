const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const rateLimit = require("express-rate-limit");
const app = express();

// Rate limiting voor login attempts
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minuten
    max: 5, // Maximaal 5 pogingen per IP
    message: { success: false, message: "Te veel login pogingen. Probeer het later opnieuw." },
    standardHeaders: true,
    legacyHeaders: false,
});

// Algemene rate limiting
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minuten
    max: 100, // Maximaal 100 requests per IP
});

app.use(generalLimiter);

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.static("."));

// Input sanitatie functie
function sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    return input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/javascript:/gi, '')
                .trim();
}

// Validatie middleware
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

// Security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';");
    next();
});

// Secret key voor JWT - gebruik environment variable
const JWT_SECRET = process.env.JWT_SECRET || "hbm-admin-secret-key-2024";

// Gebruikers database (in productie zou dit een echte database zijn)
const users = [
    {
        id: 1,
        username: "admin",
        password:
            "$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi", // password
        email: "mike@bluehub.nl",
        role: "admin",
        created: new Date("2024-01-01"),
    },
    {
        id: 2,
        username: "editor",
        password:
            "$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi", // password
        email: "info@healthybuildingmovement.com",
        role: "editor",
        created: new Date("2024-01-15"),
    },
];

// Middleware om JWT token te verificeren
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

// Login endpoint
app.post("/admin/api/login", loginLimiter, async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res
            .status(400)
            .json({
                success: false,
                message: "Gebruikersnaam en wachtwoord zijn vereist",
            });
    }

    // Zoek gebruiker
    const user = users.find((u) => u.username === username);
    if (!user) {
        return res
            .status(401)
            .json({ success: false, message: "Ongeldige inloggegevens" });
    }

    // Controleer wachtwoord
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
        return res
            .status(401)
            .json({ success: false, message: "Ongeldige inloggegevens" });
    }

    // Genereer JWT token
    const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: "8h" },
    );

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

// Gebruikers endpoints
app.get("/admin/api/users", authenticateToken, (req, res) => {
    const userList = users.map((user) => ({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        created: user.created,
    }));
    res.json(userList);
});

// Wachtwoord validatie functie
function validatePassword(password) {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (password.length < minLength) {
        return "Wachtwoord moet minimaal 8 karakters lang zijn";
    }
    if (!hasUpperCase || !hasLowerCase) {
        return "Wachtwoord moet zowel hoofdletters als kleine letters bevatten";
    }
    if (!hasNumbers) {
        return "Wachtwoord moet minimaal één cijfer bevatten";
    }
    if (!hasSpecialChar) {
        return "Wachtwoord moet minimaal één speciaal karakter bevatten";
    }
    return null;
}

app.post("/admin/api/users", authenticateToken, async (req, res) => {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password || !role) {
        return res.status(400).json({ error: "Alle velden zijn vereist" });
    }

    // Valideer wachtwoord sterkte
    const passwordError = validatePassword(password);
    if (passwordError) {
        return res.status(400).json({ error: passwordError });
    }

    // Controleer of gebruiker al bestaat
    if (users.find((u) => u.username === username)) {
        return res.status(400).json({ error: "Gebruikersnaam bestaat al" });
    }

    // Valideer email formaat
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Ongeldig email formaat" });
    }

    // Hash wachtwoord
    const hashedPassword = await bcrypt.hash(password, 10);

    // Voeg gebruiker toe
    const newUser = {
        id: users.length + 1,
        username,
        email,
        password: hashedPassword,
        role,
        created: new Date(),
    };

    users.push(newUser);

    res.status(201).json({
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        created: newUser.created,
    });
});

// Data endpoints
app.get("/admin/api/opportunities", authenticateToken, (req, res) => {
    try {
        const data = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, "../data/opportunities.json"),
                "utf8",
            ),
        );
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Fout bij het laden van data" });
    }
});

app.post("/admin/api/opportunities", authenticateToken, (req, res) => {
    try {
        const data = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, "../data/opportunities.json"),
                "utf8",
            ),
        );
        const newOpportunity = {
            ...req.body,
            id: Date.now().toString(),
        };
        data.push(newOpportunity);
        fs.writeFileSync(
            path.join(__dirname, "../data/opportunities.json"),
            JSON.stringify(data, null, 2),
        );
        res.status(201).json(newOpportunity);
    } catch (error) {
        res.status(500).json({ error: "Fout bij het opslaan van data" });
    }
});

app.put("/admin/api/opportunities/:id", authenticateToken, (req, res) => {
    try {
        const data = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, "../data/opportunities.json"),
                "utf8",
            ),
        );
        const index = data.findIndex((item) => item.Name === req.params.id);
        if (index === -1) {
            return res.status(404).json({ error: "Item niet gevonden" });
        }
        data[index] = { ...data[index], ...req.body };
        fs.writeFileSync(
            path.join(__dirname, "../data/opportunities.json"),
            JSON.stringify(data, null, 2),
        );
        res.json(data[index]);
    } catch (error) {
        res.status(500).json({ error: "Fout bij het bijwerken van data" });
    }
});

app.delete("/admin/api/opportunities/:id", authenticateToken, (req, res) => {
    try {
        const data = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, "../data/opportunities.json"),
                "utf8",
            ),
        );
        const filteredData = data.filter((item) => item.Name !== req.params.id);
        fs.writeFileSync(
            path.join(__dirname, "../data/opportunities.json"),
            JSON.stringify(filteredData, null, 2),
        );
        res.json({ message: "Item verwijderd" });
    } catch (error) {
        res.status(500).json({ error: "Fout bij het verwijderen van data" });
    }
});

// Filters endpoints
app.get("/admin/api/filters", authenticateToken, (req, res) => {
    try {
        const data = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, "../data/filters.json"),
                "utf8",
            ),
        );
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Fout bij het laden van filters" });
    }
});

app.post("/admin/api/filters", authenticateToken, (req, res) => {
    try {
        const data = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, "../data/filters.json"),
                "utf8",
            ),
        );
        const { category, value } = req.body;

        if (!data[category]) {
            data[category] = [];
        }

        if (!data[category].includes(value)) {
            data[category].push(value);
        }

        fs.writeFileSync(
            path.join(__dirname, "../data/filters.json"),
            JSON.stringify(data, null, 2),
        );
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Fout bij het opslaan van filter" });
    }
});

// Municipalities endpoints
app.get("/admin/api/municipalities", authenticateToken, (req, res) => {
    try {
        const data = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, "../data/municipalities.json"),
                "utf8",
            ),
        );
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Fout bij het laden van gemeenten" });
    }
});

// Dashboard stats endpoint
app.get("/admin/api/stats", authenticateToken, (req, res) => {
    try {
        const opportunities = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, "../data/opportunities.json"),
                "utf8",
            ),
        );
        const municipalities = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, "../data/municipalities.json"),
                "utf8",
            ),
        );

        const stats = {
            totalOpportunities: opportunities.length,
            totalProjects: opportunities.filter(
                (item) => item.HBMType === "Project",
            ).length,
            totalCompanies: opportunities.filter(
                (item) => item.HBMType === "Bedrijf",
            ).length,
            totalMunicipalities: municipalities.municipalities.length,
        };

        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: "Fout bij het laden van statistieken" });
    }
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: "Er is een serverfout opgetreden" });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Admin server draait op poort ${PORT}`);
});
