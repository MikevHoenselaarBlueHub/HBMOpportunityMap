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
app.set("trust proxy", ["127.0.0.1", "::1"]);

// Rate limiting met betere proxy configuratie - verhoogd voor ontwikkeling
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50, // Verhoogd van 5 naar 50
    message: {
        success: false,
        message: "Te veel login pogingen. Probeer het later opnieuw.",
    },
    standardHeaders: true,
    legacyHeaders: false,
    trustProxy: false, // Explicitief uitschakelen voor deze limiter
});

const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000, // Verhoogd van 100 naar 1000 voor ontwikkeling
    trustProxy: false, // Explicitief uitschakelen voor deze limiter
});

app.use(generalLimiter);

// Middleware
app.use(express.json({ limit: "10mb" }));

// Multer voor file uploads
const multer = require("multer");
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadsDir = path.join(__dirname, "uploads", "logos");
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, "logo-" + uniqueSuffix + ext);
    },
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
        } else {
            cb(new Error("Alleen afbeeldingen zijn toegestaan"));
        }
    },
});

// Security headers
app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains",
    );
    res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; " +
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://www.googletagmanager.com https://nominatim.openstreetmap.org; " +
            "style-src 'self' 'unsafe-inline' https://unpkg.com https://fonts.googleapis.com; " +
            "img-src 'self' data: blob: https: http:; " +
            "connect-src 'self' https://unpkg.com https://nominatim.openstreetmap.org https://www.googletagmanager.com; " +
            "font-src 'self' https://fonts.gstatic.com; " +
            "object-src 'none'; " +
            "base-uri 'self';",
    );
    next();
});

// Input sanitatie
function sanitizeInput(input) {
    if (typeof input !== "string") return input;
    return input
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/javascript:/gi, "")
        .trim();
}

function validateInput(req, res, next) {
    if (req.body) {
        for (const key in req.body) {
            if (typeof req.body[key] === "string") {
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
app.use("/admin", express.static(path.join(__dirname, "admin")));

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
            console.log(
                `[LOGIN] Fout: Ongeldige inloggegevens voor ${username}`,
            );
            return res
                .status(401)
                .json({ success: false, message: "Ongeldige inloggegevens" });
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
    console.log(
        `[USERS] Gebruikerslijst opgevraagd door: ${req.user.username}`,
    );
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
    console.log(
        `[CREATE_USER] Poging tot aanmaken nieuwe gebruiker door: ${req.user.username}`,
    );
    console.log(`[CREATE_USER] Data ontvangen:`, {
        username,
        email,
        role,
        password: password ? "[VERBORGEN]" : "LEEG",
    });

    try {
        const newUser = await db.createUser({
            username,
            email,
            password,
            role,
        });

        res.status(201).json({
            success: true,
            message: "Gebruiker succesvol aangemaakt",
            user: newUser,
        });
    } catch (error) {
        console.error(`[CREATE_USER] Fout bij aanmaken gebruiker:`, error);

        if (
            error.message.includes("bestaat al") ||
            error.message.includes("Ongeldige rol") ||
            error.message.includes("vereist")
        ) {
            res.status(400).json({
                success: false,
                message: error.message,
            });
        } else {
            res.status(500).json({
                success: false,
                message: "Server fout bij aanmaken gebruiker",
            });
        }
    }
});

// Gebruiker bijwerken
app.put("/admin/api/users/:id", authenticateToken, async (req, res) => {
    const userId = parseInt(req.params.id);
    const { username, email, password, role } = req.body;
    console.log(
        `[UPDATE_USER] Poging tot bijwerken gebruiker ${userId} door: ${req.user.username}`,
    );

    try {
        const updatedUser = await db.updateUser(userId, {
            username,
            email,
            password,
            role,
        });

        res.json({
            success: true,
            message: "Gebruiker succesvol bijgewerkt",
            user: updatedUser,
        });
    } catch (error) {
        console.error(
            `[UPDATE_USER] Fout bij bijwerken gebruiker ${userId}:`,
            error,
        );

        if (error.message.includes("niet gevonden")) {
            res.status(404).json({
                success: false,
                message: error.message,
            });
        } else if (
            error.message.includes("in gebruik") ||
            error.message.includes("Ongeldige rol")
        ) {
            res.status(400).json({
                success: false,
                message: error.message,
            });
        } else {
            res.status(500).json({
                success: false,
                message: "Server fout bij bijwerken gebruiker",
            });
        }
    }
});

// Gebruiker verwijderen
app.delete("/admin/api/users/:id", authenticateToken, (req, res) => {
    const userId = parseInt(req.params.id);
    console.log(
        `[DELETE_USER] Poging tot verwijderen gebruiker ${userId} door: ${req.user.username}`,
    );

    try {
        // Voorkom dat gebruiker zichzelf verwijdert
        if (userId === req.user.id) {
            console.log(
                `[DELETE_USER] Fout: Gebruiker ${req.user.username} probeert zichzelf te verwijderen`,
            );
            return res.status(400).json({
                success: false,
                message: "Je kunt jezelf niet verwijderen",
            });
        }

        const success = db.deleteUser(userId);

        if (success) {
            res.json({
                success: true,
                message: "Gebruiker succesvol verwijderd",
            });
        } else {
            res.status(500).json({
                success: false,
                message: "Fout bij verwijderen van gebruiker",
            });
        }
    } catch (error) {
        console.error(
            `[DELETE_USER] Fout bij verwijderen gebruiker ${userId}:`,
            error,
        );

        if (error.message.includes("niet gevonden")) {
            res.status(404).json({
                success: false,
                message: error.message,
            });
        } else {
            res.status(500).json({
                success: false,
                message: "Server fout bij verwijderen gebruiker",
            });
        }
    }
});

// Opportunities API
app.get("/admin/api/opportunities", authenticateToken, (req, res) => {
    try {
        const opportunities = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, "data/opportunities.json"),
                "utf8",
            ),
        );

        // Admin should see all opportunities including internal ones
        res.json(opportunities);
    } catch (error) {
        console.error("Error loading opportunities:", error);
        res.status(500).json({ error: "Failed to load opportunities" });
    }
});

app.post("/admin/api/opportunities", authenticateToken, (req, res) => {
    try {
        const opportunities = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, "data/opportunities.json"),
                "utf8",
            ),
        );

        // Add new opportunity with all supported fields
        const newOpportunity = {
            Name: req.body.Name || "",
            ProjectType: req.body.ProjectType || "",
            OrganizationType: req.body.OrganizationType || "",
            OrganizationField: req.body.OrganizationField || "",
            HBMTopic: req.body.HBMTopic || "",
            HBMCharacteristics: req.body.HBMCharacteristics || "",
            HBMSector: req.body.HBMSector || "",
            HBMType: req.body.HBMType || "",
            HBMUse: req.body.HBMUse || "external",
            Description: req.body.Description || "",
            Logo: req.body.Logo || "",
            ProjectImage: req.body.ProjectImage || "",
            Street: req.body.Street || req.body.Address || "",
            Zip: req.body.Zip || req.body.PostalCode || "",
            City: req.body.City || "",
            Municipality: req.body.Municipality || "",
            Country: req.body.Country || "",
            ContactPerson: req.body.ContactPerson || "",
            ContactEmail: req.body.ContactEmail || "",
            ContactPhone: req.body.ContactPhone || "",
            ContactWebsite: req.body.ContactWebsite || "",
            ProjectPhase: req.body.ProjectPhase || "",
            Remarks: req.body.Remarks || "",
            Latitude: req.body.Latitude || null,
            Longitude: req.body.Longitude || null,
        };

        opportunities.push(newOpportunity);

        // Create backup
        const backupDir = path.join(__dirname, "backup");
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const backupPath = path.join(
            backupDir,
            `opportunities-${timestamp}.json`,
        );
        fs.copyFileSync(
            path.join(__dirname, "data/opportunities.json"),
            backupPath,
        );

        // Save updated opportunities
        fs.writeFileSync(
            path.join(__dirname, "data/opportunities.json"),
            JSON.stringify(opportunities, null, 2),
        );

        res.json({ success: true, message: "Kans succesvol toegevoegd" });
    } catch (error) {
        console.error("Error creating opportunity:", error);
        res.status(500).json({ error: "Failed to create opportunity" });
    }
});

app.put("/admin/api/opportunities/:name", authenticateToken, (req, res) => {
    try {
        const opportunityName = decodeURIComponent(req.params.name);
        const opportunities = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, "data/opportunities.json"),
                "utf8",
            ),
        );

        const opportunityIndex = opportunities.findIndex(
            (o) => o.Name === opportunityName,
        );

        if (opportunityIndex === -1) {
            return res.status(404).json({ error: "Kans niet gevonden" });
        }

        // Update opportunity with all supported fields
        const updatedOpportunity = {
            ...opportunities[opportunityIndex],
            Name: req.body.Name || opportunities[opportunityIndex].Name,
            ProjectType:
                req.body.ProjectType !== undefined
                    ? req.body.ProjectType
                    : opportunities[opportunityIndex].ProjectType,
            OrganizationType:
                req.body.OrganizationType !== undefined
                    ? req.body.OrganizationType
                    : opportunities[opportunityIndex].OrganizationType,
            OrganizationField:
                req.body.OrganizationField !== undefined
                    ? req.body.OrganizationField
                    : opportunities[opportunityIndex].OrganizationField,
            HBMTopic:
                req.body.HBMTopic !== undefined
                    ? req.body.HBMTopic
                    : opportunities[opportunityIndex].HBMTopic,
            HBMCharacteristics:
                req.body.HBMCharacteristics !== undefined
                    ? req.body.HBMCharacteristics
                    : opportunities[opportunityIndex].HBMCharacteristics,
            HBMSector:
                req.body.HBMSector !== undefined
                    ? req.body.HBMSector
                    : opportunities[opportunityIndex].HBMSector,
            HBMType:
                req.body.HBMType !== undefined
                    ? req.body.HBMType
                    : opportunities[opportunityIndex].HBMType,
            HBMUse:
                req.body.HBMUse !== undefined
                    ? req.body.HBMUse
                    : opportunities[opportunityIndex].HBMUse,
            Description:
                req.body.Description !== undefined
                    ? req.body.Description
                    : opportunities[opportunityIndex].Description,
            Logo:
                req.body.Logo !== undefined
                    ? req.body.Logo
                    : opportunities[opportunityIndex].Logo,
            ProjectImage:
                req.body.ProjectImage !== undefined
                    ? req.body.ProjectImage
                    : opportunities[opportunityIndex].ProjectImage,
            Street:
                req.body.Street !== undefined
                    ? req.body.Street
                    : req.body.Address !== undefined
                      ? req.body.Address
                      : opportunities[opportunityIndex].Street,
            Zip:
                req.body.Zip !== undefined
                    ? req.body.Zip
                    : req.body.PostalCode !== undefined
                      ? req.body.PostalCode
                      : opportunities[opportunityIndex].Zip,
            City:
                req.body.City !== undefined
                    ? req.body.City
                    : opportunities[opportunityIndex].City,
            Municipality:
                req.body.Municipality !== undefined
                    ? req.body.Municipality
                    : opportunities[opportunityIndex].Municipality,
            Country:
                req.body.Country !== undefined
                    ? req.body.Country
                    : opportunities[opportunityIndex].Country,
            ContactPerson:
                req.body.ContactPerson !== undefined
                    ? req.body.ContactPerson
                    : opportunities[opportunityIndex].ContactPerson,
            ContactEmail:
                req.body.ContactEmail !== undefined
                    ? req.body.ContactEmail
                    : opportunities[opportunityIndex].ContactEmail,
            ContactPhone:
                req.body.ContactPhone !== undefined
                    ? req.body.ContactPhone
                    : opportunities[opportunityIndex].ContactPhone,
            ContactWebsite:
                req.body.ContactWebsite !== undefined
                    ? req.body.ContactWebsite
                    : opportunities[opportunityIndex].ContactWebsite,
            ProjectPhase:
                req.body.ProjectPhase !== undefined
                    ? req.body.ProjectPhase
                    : opportunities[opportunityIndex].ProjectPhase,
            Remarks:
                req.body.Remarks !== undefined
                    ? req.body.Remarks
                    : opportunities[opportunityIndex].Remarks,
            Latitude:
                req.body.Latitude !== undefined
                    ? req.body.Latitude
                    : opportunities[opportunityIndex].Latitude,
            Longitude:
                req.body.Longitude !== undefined
                    ? req.body.Longitude
                    : opportunities[opportunityIndex].Longitude,
        };

        opportunities[opportunityIndex] = updatedOpportunity;

        // Create backup
        const backupDir = path.join(__dirname, "backup");
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const backupPath = path.join(
            backupDir,
            `opportunities-${timestamp}.json`,
        );
        fs.copyFileSync(
            path.join(__dirname, "data/opportunities.json"),
            backupPath,
        );

        // Save updated opportunities
        fs.writeFileSync(
            path.join(__dirname, "data/opportunities.json"),
            JSON.stringify(opportunities, null, 2),
        );

        res.json({ success: true, message: "Kans succesvol bijgewerkt" });
    } catch (error) {
        console.error("Error updating opportunity:", error);
        res.status(500).json({ error: "Failed to update opportunity" });
    }
});

app.delete("/admin/api/opportunities/:name", authenticateToken, (req, res) => {
    const opportunityName = decodeURIComponent(req.params.name);
    console.log(
        `[DELETE_OPPORTUNITY] Deleting opportunity ${opportunityName} by: ${req.user.username}`,
    );

    try {
        const dataPath = path.join(__dirname, "data/opportunities.json");
        const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));

        const originalLength = data.length;
        const filteredData = data.filter(
            (item) => item.Name !== opportunityName,
        );

        if (filteredData.length === originalLength) {
            return res.status(404).json({ error: "Kans niet gevonden" });
        }

        // Create backup
        const backupDir = path.join(__dirname, "backup");
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const backupPath = path.join(
            backupDir,
            `opportunities-${timestamp}.json`,
        );
        fs.copyFileSync(dataPath, backupPath);

        fs.writeFileSync(dataPath, JSON.stringify(filteredData, null, 2));

        console.log(
            `[DELETE_OPPORTUNITY] Successfully deleted opportunity: ${opportunityName}`,
        );
        res.json({ message: "Kans succesvol verwijderd" });
    } catch (error) {
        console.error(`[DELETE_OPPORTUNITY] Error:`, error);
        res.status(500).json({ error: "Fout bij het verwijderen van kans" });
    }
});

app.get("/admin/api/filters", authenticateToken, (req, res) => {
    try {
        const data = JSON.parse(
            fs.readFileSync(path.join(__dirname, "data/filters.json"), "utf8"),
        );
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Fout bij het laden van filters" });
    }
});

// Municipality API endpoints
app.get("/admin/api/municipalities", authenticateToken, (req, res) => {
    try {
        const municipalitiesPath = path.join(
            __dirname,
            "data",
            "municipalities.json",
        );
        if (!fs.existsSync(municipalitiesPath)) {
            return res
                .status(404)
                .json({ error: "Municipalities data not found" });
        }

        const municipalitiesData = JSON.parse(
            fs.readFileSync(municipalitiesPath, "utf8"),
        );
        res.json(municipalitiesData);
    } catch (error) {
        console.error("Error loading municipalities:", error);
        res.status(500).json({ error: "Failed to load municipalities" });
    }
});

// Municipality management endpoints
app.post("/admin/api/municipalities", authenticateToken, (req, res) => {
    const { name, country, code, population, area, largest_places } = req.body;
    console.log(
        `[CREATE_MUNICIPALITY] Poging tot aanmaken gemeente door: ${req.user.username}`,
    );

    if (!name || !country || !code) {
        return res.status(400).json({
            success: false,
            message: "Naam, land en code zijn verplichte velden",
        });
    }

    try {
        const municipalitiesPath = path.join(
            __dirname,
            "data/municipalities.json",
        );
        const data = JSON.parse(fs.readFileSync(municipalitiesPath, "utf8"));

        // Check if municipality already exists
        const existingMunicipality = data.municipalities.find(
            (m) => m.name.toLowerCase() === name.toLowerCase(),
        );
        if (existingMunicipality) {
            return res.status(400).json({
                success: false,
                message: "Een gemeente met deze naam bestaat al",
            });
        }

        const newMunicipality = {
            name,
            country,
            code,
            population: population ? parseInt(population) : undefined,
            area: area || undefined,
            largest_places: largest_places
                ? largest_places.split(",").map((p) => p.trim())
                : undefined,
        };

        // Remove undefined fields
        Object.keys(newMunicipality).forEach((key) => {
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
            municipality: newMunicipality,
        });
    } catch (error) {
        console.error(`[CREATE_MUNICIPALITY] Error:`, error);
        res.status(500).json({
            success: false,
            message: "Server fout bij toevoegen gemeente",
        });
    }
});

app.put("/admin/api/municipalities/:name", authenticateToken, (req, res) => {
    const municipalityName = decodeURIComponent(req.params.name);
    const { name, country, code, population, area, largest_places } = req.body;
    console.log(
        `[UPDATE_MUNICIPALITY] Poging tot bijwerken gemeente ${municipalityName} door: ${req.user.username}`,
    );

    try {
        const municipalitiesPath = path.join(
            __dirname,
            "data/municipalities.json",
        );
        const data = JSON.parse(fs.readFileSync(municipalitiesPath, "utf8"));

        const municipalityIndex = data.municipalities.findIndex(
            (m) => m.name === municipalityName,
        );
        if (municipalityIndex === -1) {
            return res.status(404).json({
                success: false,
                message: "Gemeente niet gevonden",
            });
        }

        // Check if new name conflicts with existing (if name changed)
        if (name && name !== municipalityName) {
            const existingMunicipality = data.municipalities.find(
                (m) => m.name.toLowerCase() === name.toLowerCase(),
            );
            if (existingMunicipality) {
                return res.status(400).json({
                    success: false,
                    message: "Een gemeente met deze naam bestaat al",
                });
            }
        }

        const updatedMunicipality = {
            name: name || municipalityName,
            country: country || data.municipalities[municipalityIndex].country,
            code: code || data.municipalities[municipalityIndex].code,
            population: population
                ? parseInt(population)
                : data.municipalities[municipalityIndex].population,
            area: area || data.municipalities[municipalityIndex].area,
            largest_places: largest_places
                ? largest_places.split(",").map((p) => p.trim())
                : data.municipalities[municipalityIndex].largest_places,
        };

        // Remove undefined fields
        Object.keys(updatedMunicipality).forEach((key) => {
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
            municipality: updatedMunicipality,
        });
    } catch (error) {
        console.error(`[UPDATE_MUNICIPALITY] Error:`, error);
        res.status(500).json({
            success: false,
            message: "Server fout bij bijwerken gemeente",
        });
    }
});

app.delete("/admin/api/municipalities/:name", authenticateToken, (req, res) => {
    const municipalityName = decodeURIComponent(req.params.name);
    console.log(
        `[DELETE_MUNICIPALITY] Poging tot verwijderen gemeente ${municipalityName} door: ${req.user.username}`,
    );

    // Only admins can delete municipalities
    if (req.user.role !== "admin") {
        return res.status(403).json({
            success: false,
            message: "Alleen administrators kunnen gemeenten verwijderen",
        });
    }

    try {
        const municipalitiesPath = path.join(
            __dirname,
            "data/municipalities.json",
        );
        const data = JSON.parse(fs.readFileSync(municipalitiesPath, "utf8"));

        const municipalityIndex = data.municipalities.findIndex(
            (m) => m.name === municipalityName,
        );
        if (municipalityIndex === -1) {
            return res.status(404).json({
                success: false,
                message: "Gemeente niet gevonden",
            });
        }

        data.municipalities.splice(municipalityIndex, 1);
        fs.writeFileSync(municipalitiesPath, JSON.stringify(data, null, 2));

        res.json({
            success: true,
            message: "Gemeente succesvol verwijderd",
        });
    } catch (error) {
        console.error(`[DELETE_MUNICIPALITY] Error:`, error);
        res.status(500).json({
            success: false,
            message: "Server fout bij verwijderen gemeente",
        });
    }
});

// Filter management endpoints
app.post("/admin/api/filters/:category", authenticateToken, (req, res) => {
    const category = req.params.category;
    const { item } = req.body;
    console.log(
        `[CREATE_FILTER] Poging tot toevoegen filter item in ${category} door: ${req.user.username}`,
    );

    if (!item || !item.trim()) {
        return res.status(400).json({
            success: false,
            message: "Filter item is verplicht",
        });
    }

    try {
        const filtersPath = path.join(__dirname, "data/filters.json");
        const data = JSON.parse(fs.readFileSync(filtersPath, "utf8"));

        if (!data[category]) {
            return res.status(400).json({
                success: false,
                message: "Ongeldige filter categorie",
            });
        }

        const trimmedItem = item.trim();

        // Check if item already exists
        if (data[category].includes(trimmedItem)) {
            return res.status(400).json({
                success: false,
                message: "Dit filter item bestaat al",
            });
        }

        data[category].push(trimmedItem);
        data[category].sort();

        fs.writeFileSync(filtersPath, JSON.stringify(data, null, 2));

        res.status(201).json({
            success: true,
            message: "Filter item succesvol toegevoegd",
            item: trimmedItem,
        });
    } catch (error) {
        console.error(`[CREATE_FILTER] Error:`, error);
        res.status(500).json({
            success: false,
            message: "Server fout bij toevoegen filter item",
        });
    }
});

app.put("/admin/api/filters/:category/:item", authenticateToken, (req, res) => {
    const category = req.params.category;
    const oldItem = decodeURIComponent(req.params.item);
    const { item: newItem } = req.body;
    console.log(
        `[UPDATE_FILTER] Poging tot bijwerken filter item in ${category} door: ${req.user.username}`,
    );

    if (!newItem || !newItem.trim()) {
        return res.status(400).json({
            success: false,
            message: "Nieuw filter item is verplicht",
        });
    }

    try {
        const filtersPath = path.join(__dirname, "data/filters.json");
        const data = JSON.parse(fs.readFileSync(filtersPath, "utf8"));

        if (!data[category]) {
            return res.status(400).json({
                success: false,
                message: "Ongeldige filter categorie",
            });
        }

        const itemIndex = data[category].indexOf(oldItem);
        if (itemIndex === -1) {
            return res.status(404).json({
                success: false,
                message: "Filter item niet gevonden",
            });
        }

        const trimmedNewItem = newItem.trim();

        // Check if new item already exists (and is not the same as old)
        if (
            trimmedNewItem !== oldItem &&
            data[category].includes(trimmedNewItem)
        ) {
            return res.status(400).json({
                success: false,
                message: "Een filter item met deze naam bestaat al",
            });
        }

        data[category][itemIndex] = trimmedNewItem;
        data[category].sort();

        fs.writeFileSync(filtersPath, JSON.stringify(data, null, 2));

        res.json({
            success: true,
            message: "Filter item succesvol bijgewerkt",
            item: trimmedNewItem,
        });
    } catch (error) {
        console.error(`[UPDATE_FILTER] Error:`, error);
        res.status(500).json({
            success: false,
            message: "Server fout bij bijwerken filter item",
        });
    }
});

app.delete(
    "/admin/api/filters/:category/:item",
    authenticateToken,
    (req, res) => {
        const category = req.params.category;
        const item = decodeURIComponent(req.params.item);
        console.log(
            `[DELETE_FILTER] Poging tot verwijderen filter item ${item} in ${category} door: ${req.user.username}`,
        );

        try {
            const filtersPath = path.join(__dirname, "data/filters.json");
            const data = JSON.parse(fs.readFileSync(filtersPath, "utf8"));

            if (!data[category]) {
                return res.status(400).json({
                    success: false,
                    message: "Ongeldige filter categorie",
                });
            }

            const itemIndex = data[category].indexOf(item);
            if (itemIndex === -1) {
                return res.status(404).json({
                    success: false,
                    message: "Filter item niet gevonden",
                });
            }

            data[category].splice(itemIndex, 1);
            fs.writeFileSync(filtersPath, JSON.stringify(data, null, 2));

            res.json({
                success: true,
                message: "Filter item succesvol verwijderd",
            });
        } catch (error) {
            console.error(`[DELETE_FILTER] Error:`, error);
            res.status(500).json({
                success: false,
                message: "Server fout bij verwijderen filter item",
            });
        }
    },
);

// Save selected municipalities (simplified)
app.post(
    "/admin/api/save-selected-municipalities",
    authenticateToken,
    (req, res) => {
        try {
            const { municipalities } = req.body;

            console.log(
                `[SAVE_SELECTED] Saving ${municipalities.length} selected municipalities`,
            );

            const municipalitiesPath = path.join(
                __dirname,
                "data",
                "municipalities.json",
            );

            // Save selected municipalities
            const municipalitiesData = {
                municipalities: municipalities,
                lastUpdated: new Date().toISOString(),
                totalCount: municipalities.length,
                visibleCount: municipalities.filter(
                    (m) => m.visibility !== false,
                ).length,
            };

            fs.writeFileSync(
                municipalitiesPath,
                JSON.stringify(municipalitiesData, null, 2),
            );

            res.json({
                success: true,
                message: `${municipalities.length} geselecteerde gemeenten opgeslagen`,
                count: municipalities.length,
            });
        } catch (error) {
            console.error(
                "[SAVE_SELECTED] Error saving selected municipalities:",
                error,
            );
            res.status(500).json({
                success: false,
                message: "Fout bij opslaan van geselecteerde gemeenten",
            });
        }
    },
);

app.get("/admin/api/stats", authenticateToken, (req, res) => {
    try {
        const opportunities = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, "data/opportunities.json"),
                "utf8",
            ),
        );
        const municipalities = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, "data/municipalities.json"),
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

// Redirect /admin naar login
app.get("/admin", (req, res) => {
    res.redirect("/admin/index.html");
});

// === MAIN APP ROUTES ===

// Public API endpoints voor hoofdapplicatie (geen authenticatie vereist)
app.get("/api/opportunities", (req, res) => {
    try {
        console.log(`[API] Loading opportunities for ${req.ip}`);
        const dataPath = path.join(__dirname, "data/opportunities.json");

        if (!fs.existsSync(dataPath)) {
            console.error(`[API] File not found: ${dataPath}`);
            return res
                .status(404)
                .json({ error: "Opportunities data file not found" });
        }

        const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));

        // Filter out internal opportunities for main application
        const filteredData = data.filter((opp) => {
            const hbmUse = opp.HBMUse || "external";
            return hbmUse === "external" || hbmUse === "both";
        });

        console.log(
            `[API] Successfully loaded ${data.length} total opportunities, ${filteredData.length} visible to public`,
        );

        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-cache");
        res.json(filteredData);
    } catch (error) {
        console.error(`[API] Error loading opportunities:`, error);
        res.status(500).json({
            error: "Failed to load opportunities data",
            details: error.message,
        });
    }
});

app.get("/api/filters", (req, res) => {
    try {
        console.log(`[API] Loading filters for ${req.ip}`);
        const dataPath = path.join(__dirname, "data/filters.json");

        if (!fs.existsSync(dataPath)) {
            console.error(`[API] File not found: ${dataPath}`);
            return res
                .status(404)
                .json({ error: "Filters data file not found" });
        }

        const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
        console.log(`[API] Successfully loaded filters data`);

        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-cache");
        res.json(data);
    } catch (error) {
        console.error(`[API] Error loading filters:`, error);
        res.status(500).json({
            error: "Failed to load filters data",
            details: error.message,
        });
    }
});

app.get("/api/municipalities", (req, res) => {
    try {
        console.log(`[API] Loading municipalities for ${req.ip}`);
        const dataPath = path.join(__dirname, "data/municipalities.json");

        if (!fs.existsSync(dataPath)) {
            console.error(`[API] File not found: ${dataPath}`);
            return res
                .status(404)
                .json({ error: "Municipalities data file not found" });
        }

        const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
        console.log(`[API] Successfully loaded municipalities data`);

        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-cache");
        res.json(data);
    } catch (error) {
        console.error(`[API] Error loading municipalities:`, error);
        res.status(500).json({
            error: "Failed to load municipalities data",
            details: error.message,
        });
    }
});

// Special route for visible municipalities (filtered GeoJSON)
app.get("/data/geojson/visible-municipalities.geojson", (req, res) => {
    try {
        const filePath = path.join(
            __dirname,
            "data",
            "geojson",
            "visible-municipalities.geojson",
        );
        console.log(`[DATA] Request for visible municipalities GeoJSON`);

        if (!fs.existsSync(filePath)) {
            console.log(
                `[DATA] Visible municipalities file not found, returning 404`,
            );
            return res
                .status(404)
                .json({ error: "Visible municipalities file not found" });
        }

        res.setHeader("Content-Type", "application/geo+json");
        res.setHeader("Cache-Control", "no-cache");
        res.sendFile(filePath);
    } catch (error) {
        console.error(
            `[DATA] Error serving visible municipalities file:`,
            error,
        );
        res.status(500).json({
            error: "Failed to serve visible municipalities file",
        });
    }
});

// GeoJSON files blijven statisch beschikbaar
app.get("/data/geojson/*", (req, res) => {
    try {
        const filePath = path.join(__dirname, req.path);
        console.log(`[DATA] GeoJSON request for: ${req.path}`);

        if (!fs.existsSync(filePath)) {
            console.error(`[DATA] GeoJSON file not found: ${filePath}`);
            return res.status(404).json({ error: "GeoJSON file not found" });
        }

        res.setHeader("Content-Type", "application/geo+json");
        res.setHeader("Cache-Control", "no-cache");
        res.sendFile(filePath);
    } catch (error) {
        console.error(`[DATA] Error serving GeoJSON file:`, error);
        res.status(500).json({ error: "Failed to serve GeoJSON file" });
    }
});

// Request logging middleware for all requests
app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.url} from ${req.ip}`);
    if (req.url.startsWith("/admin/api/")) {
        console.log(
            `[API] ${req.method} ${req.url} - User: ${req.user ? req.user.username : "Niet geauthenticeerd"}`,
        );
    }
    next();
});

// Serve static files voor hoofdapplicatie - NA data routes voor juiste prioriteit
app.use(
    express.static(".", {
        index: "index.html",
        dotfiles: "ignore",
        etag: false,
        setHeaders: (res, filePath) => {
            // Cache-Control headers
            if (filePath.endsWith(".js")) {
                res.setHeader("Content-Type", "application/javascript");
                res.setHeader("Cache-Control", "no-cache");
            } else if (filePath.endsWith(".css")) {
                res.setHeader("Content-Type", "text/css");
                res.setHeader("Cache-Control", "no-cache");
            } else if (filePath.endsWith(".json")) {
                res.setHeader("Content-Type", "application/json");
                res.setHeader("Cache-Control", "no-cache");
            } else if (filePath.endsWith(".svg")) {
                res.setHeader("Content-Type", "image/svg+xml");
                res.setHeader("Cache-Control", "public, max-age=86400");
            } else if (filePath.endsWith(".html")) {
                res.setHeader("Content-Type", "text/html");
                res.setHeader("Cache-Control", "no-cache");
            }
        },
    }),
);

// Fallback voor SPA routing
app.get("*", (req, res) => {
    // Voorkom dat admin routes hier terechtkomen
    if (req.path.startsWith("/admin")) {
        return res.status(404).send("Admin page not found");
    }
    res.sendFile(path.join(__dirname, "index.html"));
});

// Error handler
app.use((err, req, res, next) => {
    console.error(`[ERROR] ${err.stack}`);
    console.error(`[ERROR] Request: ${req.method} ${req.url}`);
    console.error(`[ERROR] Body:`, req.body);
    res.status(500).json({ error: "Er is een serverfout opgetreden" });
});

app.post(
    "/admin/api/municipality-visibility",
    authenticateToken,
    async (req, res) => {
        try {
            const visibilityData = req.body;
            const visibilityPath = path.join(
                __dirname,
                "data",
                "municipality-visibility.json",
            );

            // Create backup of current visibility data
            if (fs.existsSync(visibilityPath)) {
                const backupDir = path.join(__dirname, "backup");
                if (!fs.existsSync(backupDir)) {
                    fs.mkdirSync(backupDir, { recursive: true });
                }
                const backupPath = path.join(
                    backupDir,
                    `municipality-visibility-${new Date().toISOString()}.json`,
                );
                fs.copyFileSync(visibilityPath, backupPath);
            }

            // Only save municipalities that are true (visible)
            const optimizedVisibilityData = {};
            Object.keys(visibilityData).forEach((municipalityName) => {
                if (visibilityData[municipalityName] === true) {
                    optimizedVisibilityData[municipalityName] = true;
                }
            });

            // Save optimized visibility data
            fs.writeFileSync(
                visibilityPath,
                JSON.stringify(optimizedVisibilityData, null, 2),
            );

            console.log(
                `[VISIBILITY] Saved municipality visibility data with ${Object.keys(optimizedVisibilityData).length} visible municipalities`,
            );

            res.json({
                success: true,
                message: "Gemeente zichtbaarheid succesvol opgeslagen",
                count: Object.keys(optimizedVisibilityData).length,
            });
        } catch (error) {
            console.error(
                "[VISIBILITY] Error saving municipality visibility:",
                error,
            );
            res.status(500).json({
                success: false,
                message: "Fout bij opslaan van gemeente zichtbaarheid",
            });
        }
    },
);

// Update municipality visibility in database
app.post(
    "/admin/api/update-municipality-visibility",
    authenticateToken,
    async (req, res) => {
        try {
            const visibilityData = req.body; // Only contains municipalities that are true
            const municipalitiesPath = path.join(
                __dirname,
                "data",
                "municipalities.json",
            );
            const nlGeoJsonPath = path.join(
                __dirname,
                "data",
                "geojson",
                "nl-gemeenten.geojson",
            );
            const deGeoJsonPath = path.join(
                __dirname,
                "data",
                "geojson",
                "de-gemeenten.geojson",
            );

            // Load current municipalities database
            let municipalitiesData = { municipalities: [] };
            if (fs.existsSync(municipalitiesPath)) {
                municipalitiesData = JSON.parse(
                    fs.readFileSync(municipalitiesPath, "utf8"),
                );
            }

            // Load GeoJSON data for municipality details
            const nlData = JSON.parse(fs.readFileSync(nlGeoJsonPath, "utf8"));
            const deData = JSON.parse(fs.readFileSync(deGeoJsonPath, "utf8"));

            // Create a map of existing municipalities for quick lookup
            const existingMunicipalitiesMap = {};
            municipalitiesData.municipalities.forEach((municipality) => {
                existingMunicipalitiesMap[municipality.name] = municipality;
            });

            // Process all municipalities from GeoJSON files
            const allMunicipalities = [];

            // Process Dutch municipalities
            nlData.features.forEach((feature) => {
                const municipalityName = feature.properties.name;
                if (!municipalityName) return;

                const isVisible = visibilityData[municipalityName] === true;
                const existing = existingMunicipalitiesMap[municipalityName];

                if (existing) {
                    // Update existing municipality
                    existing.visibility = isVisible;
                    allMunicipalities.push(existing);
                } else if (isVisible) {
                    // Add new municipality with details from GeoJSON
                    allMunicipalities.push({
                        name: municipalityName,
                        country: "Netherlands",
                        code: "NL",
                        population: feature.properties.population || 0,
                        area: feature.properties.area || "",
                        largest_places: feature.properties.largest_places || [],
                        visibility: true,
                    });
                }
            });

            // Process German municipalities
            deData.features.forEach((feature) => {
                const municipalityName = feature.properties.NAME_4;
                if (!municipalityName) return;

                const isVisible = visibilityData[municipalityName] === true;
                const existing = existingMunicipalitiesMap[municipalityName];

                if (existing) {
                    // Update existing municipality (only if not already processed)
                    if (
                        !allMunicipalities.find(
                            (m) => m.name === municipalityName,
                        )
                    ) {
                        existing.visibility = isVisible;
                        allMunicipalities.push(existing);
                    }
                } else if (isVisible) {
                    // Add new municipality with details from GeoJSON
                    allMunicipalities.push({
                        name: municipalityName,
                        country: "Germany",
                        code: "DE",
                        population: feature.properties.population || 0,
                        area: feature.properties.area || "",
                        largest_places: feature.properties.largest_places || [],
                        visibility: true,
                    });
                }
            });

            // Add any existing municipalities that weren't in the visibility data (set to false)
            municipalitiesData.municipalities.forEach((existing) => {
                if (!allMunicipalities.find((m) => m.name === existing.name)) {
                    existing.visibility = false;
                    allMunicipalities.push(existing);
                }
            });

            // Sort municipalities by name
            allMunicipalities.sort((a, b) => a.name.localeCompare(b.name));

            // Update municipalities data
            municipalitiesData.municipalities = allMunicipalities;
            municipalitiesData.lastUpdated = new Date().toISOString();
            municipalitiesData.totalCount = allMunicipalities.length;
            municipalitiesData.visibleCount = allMunicipalities.filter(
                (m) => m.visibility !== false,
            ).length;

            // Save updated data
            fs.writeFileSync(
                municipalitiesPath,
                JSON.stringify(municipalitiesData, null, 2),
            );

            console.log(
                `[UPDATE_VISIBILITY] Updated ${allMunicipalities.length} municipalities, ${municipalitiesData.visibleCount} visible`,
            );

            res.json({
                success: true,
                message: "Municipality visibility updated in database",
                totalCount: allMunicipalities.length,
                visibleCount: municipalitiesData.visibleCount,
            });
        } catch (error) {
            console.error(
                "[UPDATE_VISIBILITY] Error updating municipality visibility:",
                error,
            );
            res.status(500).json({
                success: false,
                message:
                    "Fout bij updaten van gemeente zichtbaarheid in database",
            });
        }
    },
);

app.post(
    "/admin/api/generate-visible-municipalities",
    authenticateToken,
    async (req, res) => {
        try {
            const visibilityPath = path.join(
                __dirname,
                "data",
                "municipality-visibility.json",
            );
            const nlGeoJsonPath = path.join(
                __dirname,
                "data",
                "geojson",
                "nl-gemeenten.geojson",
            );
            const deGeoJsonPath = path.join(
                __dirname,
                "data",
                "geojson",
                "de-gemeenten.geojson",
            );
            const outputPath = path.join(
                __dirname,
                "data",
                "geojson",
                "visible-municipalities.geojson",
            );

            // Load visibility settings
            let visibilityData = {};
            if (fs.existsSync(visibilityPath)) {
                visibilityData = JSON.parse(
                    fs.readFileSync(visibilityPath, "utf8"),
                );
            }

            // Load original GeoJSON files
            const nlData = JSON.parse(fs.readFileSync(nlGeoJsonPath, "utf8"));
            const deData = JSON.parse(fs.readFileSync(deGeoJsonPath, "utf8"));

            // Filter visible municipalities
            const visibleFeatures = [];

            // Filter Dutch municipalities
            nlData.features.forEach((feature) => {
                const municipalityName = feature.properties.name;
                if (visibilityData[municipalityName] !== false) {
                    // Default visible
                    visibleFeatures.push(feature);
                }
            });

            // Filter German municipalities
            deData.features.forEach((feature) => {
                const municipalityName = feature.properties.NAME_4;
                if (visibilityData[municipalityName] !== false) {
                    // Default visible
                    visibleFeatures.push(feature);
                }
            });

            // Create new GeoJSON with only visible municipalities
            const visibleGeoJSON = {
                type: "FeatureCollection",
                features: visibleFeatures,
            };

            // Save visible municipalities GeoJSON
            fs.writeFileSync(
                outputPath,
                JSON.stringify(visibleGeoJSON, null, 2),
            );

            console.log(
                `[VISIBILITY] Generated visible municipalities GeoJSON with ${visibleFeatures.length} municipalities`,
            );

            res.json({
                success: true,
                message: "Zichtbare gemeenten GeoJSON succesvol gegenereerd",
                count: visibleFeatures.length,
            });
        } catch (error) {
            console.error(
                "[VISIBILITY] Error generating visible municipalities GeoJSON:",
                error,
            );
            res.status(500).json({
                success: false,
                message:
                    "Fout bij het genereren van zichtbare gemeenten GeoJSON",
            });
        }
    },
);

app.post(
    "/admin/api/save-municipalities-for-kansenkaart",
    authenticateToken,
    async (req, res) => {
        try {
            const municipalitiesPath = path.join(
                __dirname,
                "data",
                "municipalities.json",
            );
            const backupDir = path.join(__dirname, "backup");

            // Ensure backup directory exists
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
            }

            // Create backup of current municipalities.json
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const backupPath = path.join(
                backupDir,
                `municipalities-${timestamp}.json`,
            );
            if (fs.existsSync(municipalitiesPath)) {
                fs.copyFileSync(municipalitiesPath, backupPath);
            }

            // Load existing municipalities data - keep the current data structure
            let municipalitiesData = { municipalities: [] };
            if (fs.existsSync(municipalitiesPath)) {
                municipalitiesData = JSON.parse(
                    fs.readFileSync(municipalitiesPath, "utf8"),
                );
            }

            // Count municipalities that have visibility=true (or undefined which means visible)
            const visibleMunicipalities =
                municipalitiesData.municipalities.filter(
                    (municipality) => municipality.visibility !== false,
                );

            // Update metadata only
            municipalitiesData.lastUpdated = new Date().toISOString();
            municipalitiesData.totalCount =
                municipalitiesData.municipalities.length;
            municipalitiesData.visibleCount = visibleMunicipalities.length;

            // Save updated metadata to municipalities.json (data remains the same)
            fs.writeFileSync(
                municipalitiesPath,
                JSON.stringify(municipalitiesData, null, 2),
            );

            console.log(
                `[SAVE_KANSENKAART] Updated municipalities metadata - ${visibleMunicipalities.length} visible out of ${municipalitiesData.municipalities.length} total`,
            );

            res.json({
                success: true,
                message: `${visibleMunicipalities.length} zichtbare gemeenten bevestigd in municipalities.json`,
                count: visibleMunicipalities.length,
                totalCount: municipalitiesData.municipalities.length,
                backupPath: backupPath,
            });
        } catch (error) {
            console.error(
                "[SAVE_KANSENKAART] Error saving municipalities for kansenkaart:",
                error,
            );
            res.status(500).json({
                success: false,
                message: "Fout bij opslaan gemeenten voor kansenkaart",
            });
        }
    },
);

// Logo upload endpoint
app.post(
    "/admin/api/upload-logo",
    authenticateToken,
    upload.single("logo"),
    (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: "Geen bestand geüpload" });
            }

            // Generate public URL for the uploaded file
            const logoUrl = `/uploads/logos/${req.file.filename}`;

            console.log(
                `[LOGO_UPLOAD] Logo uploaded: ${req.file.filename} by ${req.user.username}`,
            );

            res.json({
                success: true,
                message: "Logo succesvol geüpload",
                url: logoUrl,
                filename: req.file.filename,
                size: req.file.size,
            });
        } catch (error) {
            console.error("[LOGO_UPLOAD] Error:", error);
            res.status(500).json({ error: "Fout bij uploaden van logo" });
        }
    },
);

// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// One-time populate database from municipalities.json
app.post(
    "/admin/api/populate-municipalities-database",
    authenticateToken,
    async (req, res) => {
        try {
            if (req.user.role !== "admin") {
                return res.status(403).json({
                    success: false,
                    message: "Alleen administrators kunnen de database vullen",
                });
            }

            // Load municipalities from JSON file
            const municipalitiesPath = path.join(
                __dirname,
                "data",
                "municipalities.json",
            );
            if (!fs.existsSync(municipalitiesPath)) {
                return res.status(404).json({
                    success: false,
                    message: "municipalities.json niet gevonden",
                });
            }

            const municipalitiesData = JSON.parse(
                fs.readFileSync(municipalitiesPath, "utf8"),
            );
            const municipalities = municipalitiesData.municipalities || [];

            // Store municipalities in database with visibility: false
            const municipalitiesWithVisibility = municipalities.map(
                (municipality) => ({
                    ...municipality,
                    visibility: false,
                }),
            );

            // Save to database
            const updatedData = {
                municipalities: municipalitiesWithVisibility,
                lastUpdated: new Date().toISOString(),
                totalCount: municipalitiesWithVisibility.length,
                visibleCount: 0,
                source: "populated_from_json",
            };

            // Create backup first
            const backupDir = path.join(__dirname, "backup");
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
            }

            if (fs.existsSync(municipalitiesPath)) {
                const timestamp = new Date()
                    .toISOString()
                    .replace(/[:.]/g, "-");
                const backupPath = path.join(
                    backupDir,
                    `municipalities-before-populate-${timestamp}.json`,
                );
                fs.copyFileSync(municipalitiesPath, backupPath);
            }

            // Save updated data
            fs.writeFileSync(
                municipalitiesPath,
                JSON.stringify(updatedData, null, 2),
            );

            console.log(
                `[POPULATE_DB] Populated database with ${municipalitiesWithVisibility.length} municipalities (all visibility: false)`,
            );

            res.json({
                success: true,
                message: `Database gevuld met ${municipalitiesWithVisibility.length} gemeenten (allemaal zichtbaar: false)`,
                totalCount: municipalitiesWithVisibility.length,
                visibleCount: 0,
            });
        } catch (error) {
            console.error("[POPULATE_DB] Error populating database:", error);
            res.status(500).json({
                success: false,
                message: "Fout bij vullen van database",
            });
        }
    },
);

// Create a filtered GeoJSON file with only visible municipalities for the main application
app.post(
    "/admin/api/generate-visible-geojson",
    authenticateToken,
    async (req, res) => {
        try {
            const visibilityPath = path.join(
                __dirname,
                "data",
                "municipality-visibility.json",
            );
            const nlGeoJsonPath = path.join(
                __dirname,
                "data",
                "geojson",
                "nl-gemeenten.geojson",
            );
            const deGeoJsonPath = path.join(
                __dirname,
                "data",
                "geojson",
                "de-gemeenten.geojson",
            );
            const outputPath = path.join(
                __dirname,
                "data",
                "geojson",
                "visible-municipalities.geojson",
            );

            // Load visibility settings
            let visibilityData = {};
            if (fs.existsSync(visibilityPath)) {
                visibilityData = JSON.parse(
                    fs.readFileSync(visibilityPath, "utf8"),
                );
            }

            // Load original GeoJSON files
            const nlData = JSON.parse(fs.readFileSync(nlGeoJsonPath, "utf8"));
            const deData = JSON.parse(fs.readFileSync(deGeoJsonPath, "utf8"));

            // Filter visible municipalities
            const visibleFeatures = [];

            // Filter Dutch municipalities
            nlData.features.forEach((feature) => {
                const municipalityName = feature.properties.name;
                if (
                    municipalityName &&
                    visibilityData[municipalityName] === true
                ) {
                    visibleFeatures.push(feature);
                }
            });

            // Filter German municipalities
            deData.features.forEach((feature) => {
                const municipalityName = feature.properties.NAME_4;
                if (
                    municipalityName &&
                    visibilityData[municipalityName] === true
                ) {
                    visibleFeatures.push(feature);
                }
            });

            // Create new GeoJSON with only visible municipalities
            const visibleGeoJSON = {
                type: "FeatureCollection",
                features: visibleFeatures,
            };

            // Save visible municipalities GeoJSON
            fs.writeFileSync(
                outputPath,
                JSON.stringify(visibleGeoJSON, null, 2),
            );

            console.log(
                `[GENERATE_VISIBLE] Generated visible municipalities GeoJSON with ${visibleFeatures.length} municipalities`,
            );

            res.json({
                success: true,
                message: "Zichtbare gemeenten GeoJSON succesvol gegenereerd",
                count: visibleFeatures.length,
                filePath: outputPath,
            });
        } catch (error) {
            console.error(
                "[GENERATE_VISIBLE] Error generating visible municipalities GeoJSON:",
                error,
            );
            res.status(500).json({
                success: false,
                message:
                    "Fout bij het genereren van zichtbare gemeenten GeoJSON",
            });
        }
    },
);

// Get user information
app.get("/admin/api/user", authenticateToken, (req, res) => {
    res.json({ username: req.user.username });
});

// Check for resource updates
app.get("/admin/api/check-resources", authenticateToken, async (req, res) => {
    try {
        const https = require("https");

        // Check current versions from package.json or hardcoded
        const currentVersions = {
            leaflet: "1.9.4",
            markercluster: "1.5.3",
        };

        // Function to get latest version from npm
        const getLatestVersion = (packageName) => {
            return new Promise((resolve, reject) => {
                https
                    .get(
                        `https://registry.npmjs.org/${packageName}/latest`,
                        (res) => {
                            let data = "";
                            res.on("data", (chunk) => (data += chunk));
                            res.on("end", () => {
                                try {
                                    const packageInfo = JSON.parse(data);
                                    resolve(packageInfo.version);
                                } catch (e) {
                                    reject(e);
                                }
                            });
                        },
                    )
                    .on("error", reject);
            });
        };

        const [leafletLatest, markerclusterLatest] = await Promise.all([
            getLatestVersion("leaflet"),
            getLatestVersion("leaflet.markercluster"),
        ]);

        res.json({
            leaflet: {
                current: currentVersions.leaflet,
                latest: leafletLatest,
                needsUpdate: currentVersions.leaflet !== leafletLatest,
            },
            markercluster: {
                current: currentVersions.markercluster,
                latest: markerclusterLatest,
                needsUpdate:
                    currentVersions.markercluster !== markerclusterLatest,
            },
        });
    } catch (error) {
        console.error("Error checking resource versions:", error);
        res.status(500).json({ error: "Failed to check resource versions" });
    }
});

// Update resources
app.post("/admin/api/update-resources", authenticateToken, async (req, res) => {
    try {
        const https = require("https");
        const fs = require("fs");
        const path = require("path");

        // Create lib directory if it doesn't exist
        const libDir = path.join(__dirname, "lib");
        if (!fs.existsSync(libDir)) {
            fs.mkdirSync(libDir);
        }

        // Function to download file
        const downloadFile = (url, filepath) => {
            return new Promise((resolve, reject) => {
                const file = fs.createWriteStream(filepath);
                https
                    .get(url, (response) => {
                        response.pipe(file);
                        file.on("finish", () => {
                            file.close();
                            resolve();
                        });
                    })
                    .on("error", (err) => {
                        fs.unlink(filepath, () => {}); // Delete the file async
                        reject(err);
                    });
            });
        };

        // Download latest Leaflet
        await Promise.all([
            downloadFile(
                "https://unpkg.com/leaflet@latest/dist/leaflet.js",
                path.join(libDir, "leaflet.js"),
            ),
            downloadFile(
                "https://unpkg.com/leaflet@latest/dist/leaflet.css",
                path.join(libDir, "leaflet.css"),
            ),
            downloadFile(
                "https://unpkg.com/leaflet.markercluster@latest/dist/leaflet.markercluster.js",
                path.join(libDir, "leaflet.markercluster.js"),
            ),
            downloadFile(
                "https://unpkg.com/leaflet.markercluster@latest/dist/MarkerCluster.css",
                path.join(libDir, "MarkerCluster.css"),
            ),
            downloadFile(
                "https://unpkg.com/leaflet.markercluster@latest/dist/MarkerCluster.Default.css",
                path.join(libDir, "MarkerCluster.Default.css"),
            ),
        ]);

        res.json({ success: true, message: "Resources updated successfully" });
    } catch (error) {
        console.error("Error updating resources:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update resources: " + error.message,
        });
    }
});

// Serve static files with caching
app.use("/icons", express.static(path.join(__dirname, "icons")));
app.use("/images", express.static(path.join(__dirname, "images")));
app.use("/lib", express.static(path.join(__dirname, "lib")));

// Start server - Fixed port configuration
const PORT = 5000; // Fixed port voor consistentie
app.listen(PORT, "0.0.0.0", () => {
    const replUrl =
        process.env.REPLIT_DEV_DOMAIN ||
        `${process.env.REPL_SLUG}-${process.env.REPL_OWNER}.replit.dev`;

    console.log(`========================================`);
    console.log(`🚀 Server succesvol gestart op poort ${PORT}`);
    console.log(`📍 Server luistert op: 0.0.0.0:${PORT}`);
    console.log(`🌐 Hoofdapplicatie: https://${replUrl}/`);
    console.log(`⚙️  Admin CMS: https://${replUrl}/admin/`);
    console.log(`🔧 Data API: https://${replUrl}/data/`);
    console.log(`========================================`);

    // Log data file status for debugging
    try {
        const opportunitiesData = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, "data/opportunities.json"),
                "utf8",
            ),
        );
        console.log(
            `✅ Opportunities data loaded: ${opportunitiesData.length} items`,
        );
    } catch (error) {
        console.error(`❌ Error loading opportunities data:`, error.message);
    }

    try {
        const filtersData = JSON.parse(
            fs.readFileSync(path.join(__dirname, "data/filters.json"), "utf8"),
        );
        console.log(`✅ Filters data loaded successfully`);
    } catch (error) {
        console.error(`❌ Error loading filters data:`, error.message);
    }

    try {
        const municipalitiesData = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, "data/municipalities.json"),
                "utf8",
            ),
        );
        console.log(
            `✅ Municipalities data loaded: ${municipalitiesData.municipalities.length} items`,
        );
    } catch (error) {
        console.error(`❌ Error loading municipalities data:`, error.message);
    }
});
