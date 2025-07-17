const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

class DatabaseManager {
    constructor() {
        this.dbPath = path.join(__dirname, 'users.json');
        this.ensureDatabase();
    }

    // Zorg ervoor dat database bestaat
    ensureDatabase() {
        if (!fs.existsSync(path.dirname(this.dbPath))) {
            fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
        }

        if (!fs.existsSync(this.dbPath)) {
            const initialData = {
                users: [],
                lastId: 0,
                created: new Date().toISOString(),
                updated: new Date().toISOString()
            };
            this.saveDatabase(initialData);
        }
    }

    // Laad database
    loadDatabase() {
        try {
            const data = fs.readFileSync(this.dbPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('[DB] Error loading database:', error);
            return { users: [], lastId: 0, created: new Date().toISOString(), updated: new Date().toISOString() };
        }
    }

    // Sla database op
    saveDatabase(data) {
        try {
            data.updated = new Date().toISOString();
            fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2));
            console.log('[DB] Database saved successfully');
            return true;
        } catch (error) {
            console.error('[DB] Error saving database:', error);
            return false;
        }
    }

    // Haal alle gebruikers op
    getAllUsers() {
        const db = this.loadDatabase();
        return db.users.map(user => ({
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            created: user.created,
            updated: user.updated
        }));
    }

    // Zoek gebruiker op username
    findUserByUsername(username) {
        const db = this.loadDatabase();
        return db.users.find(user => user.username === username);
    }

    // Zoek gebruiker op ID
    findUserById(id) {
        const db = this.loadDatabase();
        return db.users.find(user => user.id === id);
    }

    // Zoek gebruiker op email
    findUserByEmail(email) {
        const db = this.loadDatabase();
        return db.users.find(user => user.email === email);
    }

    // Valideer wachtwoord
    async validatePassword(username, password) {
        const db = this.loadDatabase();
        const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
        if (!user) return null;

        const isValid = await bcrypt.compare(password, user.password);
        return isValid ? user : null;
    }

    // Maak nieuwe gebruiker aan
    async createUser(userData) {
        const { username, email, password, role } = userData;

        // Validatie
        if (!username || !email || !password || !role) {
            throw new Error('Alle velden zijn vereist');
        }

        const db = this.loadDatabase();

        const validRoles = ['admin', 'editor'];
        if (!validRoles.includes(role)) {
            throw new Error('Ongeldige rol');
        }

        // Check of username al bestaat (case-insensitive)
        if (db.users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
            throw new Error('Gebruikersnaam bestaat al');
        }

        if (db.users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
            throw new Error('Gebruiker met dit email bestaat al');
        }



        // Hash wachtwoord
        const hashedPassword = await bcrypt.hash(password, 10);

        // Nieuwe gebruiker
        const newUser = {
            id: db.lastId + 1,
            username,
            email,
            password: hashedPassword,
            role,
            created: new Date().toISOString(),
            updated: new Date().toISOString()
        };

        // Voeg toe aan database
        db.users.push(newUser);
        db.lastId = newUser.id;

        if (this.saveDatabase(db)) {
            console.log(`[DB] User created: ${username} (ID: ${newUser.id})`);
            return {
                id: newUser.id,
                username: newUser.username,
                email: newUser.email,
                role: newUser.role,
                created: newUser.created,
                updated: newUser.updated
            };
        } else {
            throw new Error('Fout bij opslaan van gebruiker');
        }
    }

    // Update gebruiker
    async updateUser(userId, updateData) {
        const db = this.loadDatabase();
        const userIndex = db.users.findIndex(u => u.id === userId);

        if (userIndex === -1) {
            throw new Error('Gebruiker niet gevonden');
        }

        const user = db.users[userIndex];

        // Update velden
        if (updateData.username && updateData.username !== user.username) {
            // Check of nieuwe username al bestaat
            if (db.users.find(u => u.username === updateData.username && u.id !== userId)) {
                throw new Error('Gebruikersnaam is al in gebruik');
            }
            user.username = updateData.username;
        }

        if (updateData.email && updateData.email !== user.email) {
            // Check of nieuwe email al bestaat
           if (updateData.email && updateData.email.toLowerCase() !== user.email.toLowerCase()) {
                const existingEmail = db.users.find(u => u.email.toLowerCase() === updateData.email.toLowerCase() && u.id !== userId);
                if (existingEmail) {
                    throw new Error('Email is al in gebruik');
                }
            }
            user.email = updateData.email;
        }

        if (updateData.role) {
            const validRoles = ['admin', 'editor'];
            if (!validRoles.includes(updateData.role)) {
                throw new Error('Ongeldige rol');
            }
            user.role = updateData.role;
        }

        if (updateData.password) {
            user.password = await bcrypt.hash(updateData.password, 10);
        }

        user.updated = new Date().toISOString();

        if (this.saveDatabase(db)) {
            console.log(`[DB] User updated: ${user.username} (ID: ${userId})`);
            return {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                created: user.created,
                updated: user.updated
            };
        } else {
            throw new Error('Fout bij bijwerken van gebruiker');
        }
    }

    // Verwijder gebruiker
    deleteUser(userId) {
        const db = this.loadDatabase();
        const userIndex = db.users.findIndex(u => u.id === userId);

        if (userIndex === -1) {
            throw new Error('Gebruiker niet gevonden');
        }

        const deletedUser = db.users.splice(userIndex, 1)[0];

        if (this.saveDatabase(db)) {
            console.log(`[DB] User deleted: ${deletedUser.username} (ID: ${userId})`);
            return true;
        } else {
            throw new Error('Fout bij verwijderen van gebruiker');
        }
    }

    // Database statistieken
    getStats() {
        const db = this.loadDatabase();
        return {
            totalUsers: db.users.length,
            adminCount: db.users.filter(u => u.role === 'admin').length,
            editorCount: db.users.filter(u => u.role === 'editor').length,
            lastUpdated: db.updated
        };
    }

    // Backup database
    createBackup() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = path.join(__dirname, `users-backup-${timestamp}.json`);
            const currentData = this.loadDatabase();

            fs.writeFileSync(backupPath, JSON.stringify(currentData, null, 2));
            console.log(`[DB] Backup created: ${backupPath}`);
            return backupPath;
        } catch (error) {
            console.error('[DB] Error creating backup:', error);
            return null;
        }
    }

    // Authenticate user
    async authenticateUser(username, password) {
        const db = this.loadDatabase();
        const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
        if (!user) {
            return { success: false, message: 'Gebruiker niet gevonden' };
        }

        const isValid = await bcrypt.compare(password, user.password);
        if(!isValid){
             return { success: false, message: 'Wachtwoord is onjuist' };
        }

        return { success: true, message: 'Login succesvol', user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                created: user.created,
                updated: user.updated
            } };
    }
}

module.exports = DatabaseManager;