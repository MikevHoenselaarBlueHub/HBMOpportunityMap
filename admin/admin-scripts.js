// Admin Dashboard JavaScript
class AdminDashboard {
    constructor() {
        this.currentSection = "dashboard";
        this.token = localStorage.getItem("admin_token");
        this.userRole = null;
        this.userInfo = null;
        this.init();
    }

    init() {
        // Check if user is logged in
        if (!this.token) {
            window.location.href = "/admin/index.html";
            return;
        }

        // Decode token to get user info
        this.decodeToken();

        // Setup role-based UI
        this.setupRoleBasedUI();

        // Load initial data
        this.loadDashboardData();
        this.setupEventListeners();
    }

    decodeToken() {
        try {
            // Simple JWT decode (voor display doeleinden)
            const payload = JSON.parse(atob(this.token.split(".")[1]));
            this.userRole = payload.role;
            this.userInfo = {
                username: payload.username,
                role: payload.role,
                id: payload.id,
            };
            console.log("[AUTH] User info decoded:", this.userInfo);

            // Update user display immediately
            this.updateUserDisplay();
        } catch (error) {
            console.error("[AUTH] Error decoding token:", error);
            localStorage.removeItem("admin_token");
            window.location.href = "/admin/index.html";
        }
    }

    updateUserDisplay() {
        const currentUserElement = document.getElementById("currentUser");
        if (currentUserElement && this.userInfo) {
            const roleDisplayName =
                this.userRole === "admin" ? "Administrator" : "Editor";
            currentUserElement.innerHTML = `
                <div style="text-align: left;">
                    <div style="font-weight: bold;">${this.userInfo.username}</div>
                    <div style="font-size: 0.8em; color: #999;">${roleDisplayName}</div>
                </div>
            `;
        }
    }

    setupRoleBasedUI() {
        // User display is already handled in updateUserDisplay()

        // Hide/show navigation items based on role
        if (this.userRole === "editor") {
            // Verberg admin-only secties voor editors
            const adminOnlyItems = ["users", "settings"];

            adminOnlyItems.forEach((sectionName) => {
                const navLink = document.querySelector(
                    `[href="#${sectionName}"]`,
                );
                if (navLink) {
                    navLink.style.display = "none";
                }

                const section = document.getElementById(
                    `${sectionName}-section`,
                );
                if (section) {
                    section.style.display = "none";
                }
            });

            // Update dashboard stats voor editors (verberg gebruiker stats)
            this.hideAdminStats();
        }

        // Show role-specific welcome message
        this.showRoleMessage();
    }

    hideAdminStats() {
        // Voor editors: focus op content stats, niet op gebruiker stats
        setTimeout(() => {
            const statsGrid = document.querySelector(".stats-grid");
            if (statsGrid && this.userRole === "editor") {
                // Voeg editor-specifieke melding toe
                const editorMessage = document.createElement("div");
                editorMessage.innerHTML = `
                    <div style="background: #e3f2fd; border: 1px solid #2196f3; border-radius: 4px; padding: 1rem; margin-bottom: 1rem;">
                        <strong>👋 Welkom ${this.userInfo.username}!</strong><br>
                        Als Editor kun je kansen, filters en gemeenten beheren. Voor gebruikersbeheer en systeeminstellingen heb je admin rechten nodig.
                    </div>
                `;
                statsGrid.parentNode.insertBefore(editorMessage, statsGrid);
            }
        }, 100);
    }

    showRoleMessage() {
        const permissions = this.getRolePermissions();
        console.log(
            `[ROLE] Gebruiker ${this.userInfo.username} heeft ${this.userRole} rechten:`,
            permissions,
        );
    }

    getRolePermissions() {
        const permissions = {
            admin: [
                "Alle kansen beheren",
                "Alle filters beheren",
                "Alle gemeenten beheren",
                "Gebruikers aanmaken/bewerken/verwijderen",
                "Systeeminstellingen wijzigen",
                "Data export/import",
                "Volledige toegang tot alle functies",
            ],
            editor: [
                "Kansen beheren (toevoegen/bewerken/verwijderen)",
                "Filters beheren (toevoegen/bewerken/verwijderen)",
                "Gemeenten beheren (toevoegen/bewerken/verwijderen)",
                "Dashboard statistieken bekijken",
            ],
        };

        return permissions[this.userRole] || [];
    }

    hasPermission(action) {
        const rolePermissions = {
            admin: ["all"],
            editor: [
                "view_dashboard",
                "manage_opportunities",
                "manage_filters",
                "manage_municipalities",
                "view_stats",
            ],
        };

        if (this.userRole === "admin") {
            return true; // Admin heeft alle rechten
        }

        return rolePermissions[this.userRole]?.includes(action) || false;
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll(".nav-link").forEach((link) => {
            link.addEventListener("click", (e) => {
                e.preventDefault();
                const section = link.getAttribute("href").substring(1);
                this.showSection(section);
            });
        });

        // Settings form
        document
            .getElementById("appSettingsForm")
            .addEventListener("submit", (e) => {
                e.preventDefault();
                this.saveSettings();
            });
    }

    showSection(sectionName) {
        // Check permissions
        if (!this.canAccessSection(sectionName)) {
            alert(
                `Je hebt geen toegang tot deze sectie. Je huidige rol (${this.userRole}) heeft hiervoor onvoldoende rechten.`,
            );
            return;
        }

        // Hide all sections
        document.querySelectorAll(".content-section").forEach((section) => {
            section.classList.remove("active");
        });

        // Remove active class from all nav links
        document.querySelectorAll(".nav-link").forEach((link) => {
            link.classList.remove("active");
        });

        // Show selected section
        document
            .getElementById(sectionName + "-section")
            .classList.add("active");

        // Add active class to clicked nav link
        document
            .querySelector(`[href="#${sectionName}"]`)
            .classList.add("active");

        // Update page title
        const titles = {
            dashboard: "Dashboard",
            opportunities: "Kansen beheer",
            filters: "Filter beheer",
            municipalities: "Gemeenten",
            users: "Gebruikers beheer",
            settings: "Systeeminstellingen",
        };
        document.getElementById("pageTitle").textContent =
            titles[sectionName] || "Dashboard";

        // Load section-specific data
        this.loadSectionData(sectionName);
        this.currentSection = sectionName;
    }

    canAccessSection(sectionName) {
        const adminOnlySections = ["users", "settings"];

        if (this.userRole === "admin") {
            return true; // Admin heeft toegang tot alles
        }

        if (this.userRole === "editor") {
            return !adminOnlySections.includes(sectionName);
        }

        return false;
    }

    async loadDashboardData() {
        try {
            // Load opportunities data
            const opportunitiesResponse = await fetch(
                "/data/opportunities.json",
            );
            const opportunities = await opportunitiesResponse.json();

            // Calculate stats
            const totalOpportunities = opportunities.length;
            const totalProjects = opportunities.filter(
                (item) => item.HBMType === "Project",
            ).length;
            const totalCompanies = opportunities.filter(
                (item) => item.HBMType === "Bedrijf",
            ).length;

            // Load municipalities data
            const municipalitiesResponse = await fetch(
                "/data/municipalities.json",
            );
            const municipalitiesData = await municipalitiesResponse.json();
            const totalMunicipalities =
                municipalitiesData.municipalities.length;

            // Update stats
            document.getElementById("totalOpportunities").textContent =
                totalOpportunities;
            document.getElementById("totalProjects").textContent =
                totalProjects;
            document.getElementById("totalCompanies").textContent =
                totalCompanies;
            document.getElementById("totalMunicipalities").textContent =
                totalMunicipalities;
        } catch (error) {
            console.error("Error loading dashboard data:", error);
        }
    }

    async loadSectionData(sectionName) {
        switch (sectionName) {
            case "opportunities":
                await this.loadOpportunities();
                break;
            case "filters":
                await this.loadFilters();
                break;
            case "municipalities":
                await this.loadMunicipalities();
                break;
            case "users":
                await this.loadUsers();
                break;
            case "settings":
                // Automatically check resource versions when loading settings
                setTimeout(() => {
                    this.checkResourceUpdates();
                }, 500);
                break;
        }
    }

    async loadFilters() {
        try {
            const response = await fetch("/data/filters.json");

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const responseText = await response.text();
            let filters;

            try {
                filters = JSON.parse(responseText);
            } catch (parseError) {
                console.error("Failed to parse filters JSON:", responseText);
                throw new Error("Invalid JSON response from server");
            }

            const container = document.getElementById("filtersContainer");
            if (!container) return;

            container.innerHTML = "";

            Object.keys(filters).forEach((category) => {
                const section = document.createElement("div");
                section.className = "filter-section";

                const canEdit =
                    this.userRole === "admin" || this.userRole === "editor";
                const canDelete = this.userRole === "admin";

                section.innerHTML = `
                    <div class="section-header">
                        <h3>${this.getCategoryDisplayName(category)} (${filters[category].length})</h3>
                        <div class="section-actions">
                            ${canEdit ? `<button class="add-item-btn" onclick="adminApp.openFilterModal('${category}')" title="Nieuw item toevoegen">+</button>` : ""}
                        </div>
                    </div>
                    <div class="filter-items">
                        ${filters[category]
                            .map(
                                (item) => `
                            <div class="filter-item">
                                <span>${item}</span>
                                <div class="filter-actions">
                                    ${canEdit ? `<button class="action-btn edit-btn" onclick="adminApp.openFilterModal('${category}', '${item}')" title="Bewerken"><img src="icons/edit.svg" alt="Bewerken" style="width: 14px; height: 14px;" /></button>` : ""}
                                    ${canDelete ? `<button class="action-btn delete-btn" onclick="adminApp.deleteFilterItem('${category}', '${item}')">Verwijderen</button>` : ""}
                                </div>
                            </div>
                        `,
                            )
                            .join("")}
                    </div>
                `;

                container.appendChild(section);
            });
        } catch (error) {
            console.error("Error loading filters:", error);
            alert("Fout bij het laden van filters");
        }
    }

    renderFilterCategory(containerId, items) {
        const container = document.getElementById(containerId);
        container.innerHTML = "";

        // Add button to add new filter item
        const addButton = document.createElement("button");
        addButton.className = "btn btn-primary";
        addButton.style.cssText = "margin-bottom: 1rem; width: 100%;";
        addButton.textContent = "Nieuw item toevoegen";
        addButton.onclick = () => this.openAddFilterItemModal(containerId);
        container.appendChild(addButton);

        items.forEach((item) => {
            const div = document.createElement("div");
            div.style.cssText =
                "display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; padding: 0.5rem; background: white; border-radius: 4px; border: 1px solid #ddd;";
            div.innerHTML = `
                <span>${item}</span>
                <div>
                    <button class="action-btn edit-btn" onclick="editFilterItem('${containerId}', '${item}')" style="margin-right: 0.5rem;">Bewerken</button>
                    <button class="action-btn delete-btn" onclick="deleteFilterItem('${containerId}', '${item}')">×</button>
                </div>
            `;
            container.appendChild(div);
        });
    }

    async loadMunicipalities() {
        try {
            // Load municipalities from database
            const response = await fetch("/admin/api/municipalities", {
                headers: {
                    Authorization: `Bearer ${this.token}`,
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("Municipality API error:", errorText);
                throw new Error(
                    `Failed to load municipalities: ${response.status}`,
                );
            }

            const responseText = await response.text();
            let data;

            try {
                data = JSON.parse(responseText);
            } catch (parseError) {
                console.error(
                    "Failed to parse municipalities JSON:",
                    responseText,
                );
                throw new Error(
                    "Invalid JSON response from municipalities API",
                );
            }

            // Get all municipalities from database
            const allMunicipalities = data.municipalities || [];

            const tableBody = document.querySelector(
                "#municipalitiesTable tbody",
            );
            if (!tableBody) return;

            tableBody.innerHTML = "";

            // Check if database is empty and show populate option
            if (allMunicipalities.length === 0) {
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td colspan="6" style="text-align: center; padding: 2rem;">
                        <div style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 20px; margin: 10px;">
                            <h4 style="color: #495057; margin-bottom: 15px;">Database is leeg</h4>
                            <p style="color: #6c757d; margin-bottom: 20px;">Er zijn nog geen gemeenten in de database. Klik op de knop hieronder om de database eenmalig te vullen met gegevens uit municipalities.json.</p>
                            ${
                                this.userRole === "admin"
                                    ? `<button class="btn btn-primary" onclick="adminApp.populateMunicipalitiesDatabase()" style="background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">
                                    Database vullen met gemeenten
                                </button>`
                                    : '<p style="color: #dc3545;">Alleen administrators kunnen de database vullen.</p>'
                            }
                        </div>
                    </td>
                `;
                tableBody.appendChild(row);
                return;
            }

            allMunicipalities.forEach((municipality) => {
                const row = document.createElement("tr");

                const canEdit =
                    this.userRole === "admin" || this.userRole === "editor";
                const canDelete = this.userRole === "admin";

                // Format municipality name with largest places
                let municipalityDisplay = `<div class="municipality-info">
                    <div class="municipality-name">${municipality.name}${municipality.country === "Netherlands" ? " (NL)" : municipality.country === "Germany" ? " (DE)" : ""}</div>`;

                if (
                    municipality.largest_places &&
                    municipality.largest_places.length > 0
                ) {
                    const places = municipality.largest_places
                        .slice(0, 3)
                        .join(", ");
                    municipalityDisplay += `<div class="municipality-places">${places}</div>`;
                }

                municipalityDisplay += "</div>";

                // Show visibility status
                const visibilityStatus =
                    municipality.visibility !== false
                        ? '<span style="color: #28a745; font-weight: bold;">✓ Zichtbaar</span>'
                        : '<span style="color: #dc3545;">✗ Verborgen</span>';

                row.innerHTML = `
                    <td>${municipalityDisplay}</td>
                    <td>${municipality.country}</td>
                    <td>${municipality.code || ""}</td>
                    <td>${municipality.population ? municipality.population.toLocaleString() : ""}</td>
                    <td>${municipality.area || ""}</td>
                    <td>${visibilityStatus}</td>
                    <td>
                        ${canEdit ? `<button class="action-btn edit-btn" onclick="adminApp.openMunicipalityModal('${municipality.name}')" title="Bewerken"></button>` : ""}
                        ${canDelete ? `<button class="action-btn delete-btn" onclick="adminApp.deleteMunicipality('${municipality.name}')">Verwijderen</button>` : ""}
                        ${!canEdit && !canDelete ? '<span style="color: #999;">Geen acties beschikbaar</span>' : ""}
                    </td>
                `;
                tableBody.appendChild(row);
            });
        } catch (error) {
            console.error("Error loading municipalities:", error);
            alert("Fout bij het laden van gemeenten");
        }
    }

    async populateMunicipalitiesDatabase() {
        if (this.userRole !== "admin") {
            alert("Alleen administrators kunnen de database vullen.");
            return;
        }

        if (
            !confirm(
                "Weet je zeker dat je de database wilt vullen met gemeenten uit municipalities.json? Alle gemeenten krijgen visibility: false.",
            )
        ) {
            return;
        }

        try {
            const response = await fetch(
                "/admin/api/populate-municipalities-database",
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${this.token}`,
                    },
                },
            );

            const result = await response.json();

            if (response.ok) {
                alert(
                    `Database succesvol gevuld! ${result.totalCount} gemeenten toegevoegd (allemaal zichtbaar: false).`,
                );
                this.loadMunicipalities(); // Reload the table
            } else {
                alert(`Fout bij vullen database: ${result.message}`);
            }
        } catch (error) {
            console.error("Error populating database:", error);
            alert("Fout bij vullen van database");
        }
    }

    async loadUsers() {
        // Check if user has permission to view users
        if (!this.hasPermission("manage_users") && this.userRole !== "admin") {
            const tableBody = document.getElementById("usersTableBody");
            if (tableBody) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align: center; padding: 2rem; color: #666;">
                            <strong>Toegang geweigerd</strong><br>
                            Je hebt geen rechten om gebruikers te beheren.<br>
                            Alleen administrators kunnen gebruikers bekijken en bewerken.
                        </td>
                    </tr>
                `;
            }
            return;
        }

        try {
            const response = await fetch("/admin/api/users", {
                headers: {
                    Authorization: `Bearer ${this.token}`,
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("Users API error:", errorText);
                throw new Error(`Failed to load users: ${response.status}`);
            }

            const responseText = await response.text();
            let users;

            try {
                users = JSON.parse(responseText);
            } catch (parseError) {
                console.error("Failed to parse users JSON:", responseText);
                throw new Error("Invalid JSON response from users API");
            }

            const tableBody = document.getElementById("usersTableBody");
            tableBody.innerHTML = "";

            users.forEach((user) => {
                const canEditUser =
                    this.userRole === "admin" || user.id === this.userInfo.id;
                const canDeleteUser =
                    this.userRole === "admin" && user.id !== this.userInfo.id;

                const row = document.createElement("tr");
                row.innerHTML = `
                    <td>${user.username}</td>
                    <td>${user.email}</td>
                    <td>
                        <span class="role-badge role-${user.role}">
                            ${user.role === "admin" ? "Administrator" : "Editor"}
                        </span>
                    </td>
                    <td>${new Date(user.created).toLocaleDateString("nl-NL")}</td>
                    <td class="action-buttons">
                        ${canEditUser ? `<button class="action-btn edit-btn" onclick="editUser(${user.id})">Bewerken</button>` : ""}
                        ${canDeleteUser ? `<button class="action-btn delete-btn" onclick="deleteUser(${user.id})">Verwijderen</button>` : ""}
                        ${!canEditUser && !canDeleteUser ? '<span style="color: #999;">Geen acties beschikbaar</span>' : ""}
                    </td>
                `;
                tableBody.appendChild(row);
            });
        } catch (error) {
            console.error("Error loading users:", error);
            alert("Fout bij het laden van gebruikers");
        }
    }

    openUserModal(userId = null) {
        // Check permissions
        if (this.userRole !== "admin") {
            alert(
                "Alleen administrators kunnen gebruikers aanmaken of bewerken.",
            );
            return;
        }

        const isEdit = userId !== null;

        const modalHTML = `
            <div id="userModal" class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>${isEdit ? "Gebruiker bewerken" : "Nieuwe gebruiker toevoegen"}</h3>
                        <button class="modal-close" onclick="closeModal()">×</button>
                    </div>
                    <form id="userForm" class="modal-form">
                        <div class="form-group">
                            <label for="username">Gebruikersnaam *</label>
                            <input type="text" id="username" name="username" required ${isEdit ? "readonly" : ""}>
                        </div>
                        <div class="form-group">
                            <label for="email">Email *</label>
                            <input type="email" id="email" name="email" required>
                        </div>
                        <div class="form-group">
                            <label for="password">Wachtwoord ${isEdit ? "(laat leeg om niet te wijzigen)" : "*"}</label>
                            <input type="password" id="password" name="password" ${isEdit ? "" : "required"}>
                            <small>Minimaal 8 karakters, moet hoofdletters, kleine letters, cijfers en speciale karakters bevatten</small>
                        </div>
                        <div class="form-group">
                            <label for="role">Rol *</label>
                            <select id="role" name="role" required>
                                <option value="">Selecteer rol</option>
                                <option value="admin">Administrator - Volledige toegang</option>
                                <option value="editor">Editor - Content beheer alleen</option>
                            </select>
                            <small>
                                <strong>Administrator:</strong> Alle rechten inclusief gebruikersbeheer en systeeminstellingen<br>
                                <strong>Editor:</strong> Kan alleen kansen, filters en gemeenten beheren
                            </small>
                        </div>
                        <div class="modal-actions">
                            <button type="button" class="btn btn-secondary" onclick="closeModal()">Annuleren</button>
                            <button type="submit" class="btn btn-primary">${isEdit ? "Opslaan" : "Toevoegen"}</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML("beforeend", modalHTML);

        const form = document.getElementById("userForm");
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            if (isEdit) {
                this.updateUser(userId);
            } else {
                this.createUser();
            }
        });

        if (isEdit) {
            this.loadUserData(userId);
        }
    }

    async loadUserData(userId) {
        try {
            const response = await fetch("/admin/api/users", {
                headers: {
                    Authorization: `Bearer ${this.token}`,
                },
            });

            if (!response.ok) {
                throw new Error("Failed to load user data");
            }

            const users = await response.json();
            const user = users.find((u) => u.id === userId);

            if (user) {
                document.getElementById("username").value = user.username;
                document.getElementById("email").value = user.email;
                document.getElementById("role").value = user.role;
            }
        } catch (error) {
            console.error("Error loading user data:", error);
            alert("Fout bij het laden van gebruikersgegevens");
        }
    }

    async createUser() {
        const formData = new FormData(document.getElementById("userForm"));
        const userData = {
            username: formData.get("username"),
            email: formData.get("email"),
            password: formData.get("password"),
            role: formData.get("role"),
        };

        try {
            const response = await fetch("/admin/api/users", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.token}`,
                },
                body: JSON.stringify(userData),
            });

            const result = await response.json();

            if (response.ok) {
                closeModal();
                this.loadUsers();
            } else {
                alert(`Fout: ${result.error || "Onbekende fout"}`);
            }
        } catch (error) {
            console.error("Error creating user:", error);
            alert("Fout bij het toevoegen van gebruiker");
        }
    }

    async updateUser(userId) {
        const formData = new FormData(document.getElementById("userForm"));
        const userData = {
            email: formData.get("email"),
            role: formData.get("role"),
        };

        const password = formData.get("password");
        if (password) {
            userData.password = password;
        }

        try {
            const response = await fetch(`/admin/api/users/${userId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.token}`,
                },
                body: JSON.stringify(userData),
            });

            const result = await response.json();

            if (response.ok) {
                closeModal();
                this.loadUsers();
            } else {
                alert(`Fout: ${result.error || "Onbekende fout"}`);
            }
        } catch (error) {
            console.error("Error updating user:", error);
            alert("Fout bij het bijwerken van gebruiker");
        }
    }

    async deleteUser(userId) {
        try {
            const response = await fetch(`/admin/api/users/${userId}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${this.token}`,
                },
            });

            const result = await response.json();

            if (response.ok) {
                this.loadUsers();
            } else {
                alert(`Fout: ${result.error || "Onbekende fout"}`);
            }
        } catch (error) {
            console.error("Error deleting user:", error);
            alert("Fout bij het verwijderen van gebruiker");
        }
    }

    saveSettings() {
        const appTitle = document.getElementById("appTitle").value;
        const defaultZoom = document.getElementById("defaultZoom").value;

        // Save settings to localStorage for now
        localStorage.setItem(
            "app_settings",
            JSON.stringify({
                appTitle,
                defaultZoom: parseInt(defaultZoom),
            }),
        );

        // Settings saved silently
    }

    exportData() {
        // Export all data as JSON
        Promise.all([
            fetch("/data/opportunities.json").then((r) => r.json()),
            fetch("/data/filters.json").then((r) => r.json()),
            fetch("/data/municipalities.json").then((r) => r.json()),
        ]).then(([opportunities, filters, municipalities]) => {
            const exportData = {
                opportunities,
                filters,
                municipalities,
                exportDate: new Date().toISOString(),
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `hbm-data-export-${new Date().toISOString().split("T")[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
        });
    }

    importData() {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json";
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const data = JSON.parse(e.target.result);
                        console.log("Imported data:", data);
                        alert(
                            "Data ge �mporteerd! (Implementatie vereist voor opslaan naar server)",
                        );
                    } catch (error) {
                        alert(
                            "Fout bij het importeren van data. Controleer het bestand.",
                        );
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    }

    refreshData() {
        this.loadDashboardData();
        this.loadSectionData(this.currentSection);
        // Data refreshed silently
    }

    // Municipality Management Functions
    openMunicipalityModal(municipalityName = null) {
        const isEdit = municipalityName !== null;

        const modalHTML = `
            <div id="municipalityModal" class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>${isEdit ? "Gemeente bewerken" : "Nieuwe gemeente toevoegen"}</h3>
                        <button class="modal-close" onclick="closeModal('municipalityModal')">×</button>
                    </div>
                    <form id="municipalityForm" class="modal-form">
                        <div class="form-group">
                            <label for="municipalityName">Naam *</label>
                            <input type="text" id="municipalityName" name="name" required>
                        </div>
                        <div class="form-group">
                            <label for="municipalityCountry">Land *</label>
                            <select id="municipalityCountry" name="country" required>
                                <option value="">Selecteer land</option>
                                <option value="Netherlands">Nederland</option>
                                <option value="Germany">Duitsland</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="municipalityCode">Code *</label>
                            <select id="municipalityCode" name="code" required>
                                <option value="">Selecteer code</option>
                                <option value="NL">NL</option>
                                <option value="DE">DE</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="municipalityPopulation">Inwoners</label>
                            <input type="number" id="municipalityPopulation" name="population" min="0">
                        </div>
                        <div class="form-group">
                            <label for="municipalityArea">Oppervlakte</label>
                            <input type="text" id="municipalityArea" name="area" placeholder="bijv. 45,32 km²">
                        </div>
                        <div class="form-group">
                            <label for="municipalityPlaces">Grootste plaatsen</label>
                            <input type="text" id="municipalityPlaces" name="largest_places" placeholder="Gescheiden door komma's">
                            <small>Voer plaatsnamen in gescheiden door komma's</small>
                        </div>
                        <div class="modal-actions">
                            <button type="button" class="btn btn-secondary" onclick="closeModal('municipalityModal')">Annuleren</button>
                            <button type="submit" class="btn btn-primary">${isEdit ? "Opslaan" : "Toevoegen"}</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML("beforeend", modalHTML);

        // Set up country-code synchronization
        const countrySelect = document.getElementById("municipalityCountry");
        const codeSelect = document.getElementById("municipalityCode");

        countrySelect.addEventListener("change", () => {
            if (countrySelect.value === "Netherlands") {
                codeSelect.value = "NL";
            } else if (countrySelect.value === "Germany") {
                codeSelect.value = "DE";
            }
        });

        codeSelect.addEventListener("change", () => {
            if (codeSelect.value === "NL") {
                countrySelect.value = "Netherlands";
            } else if (codeSelect.value === "DE") {
                countrySelect.value = "Germany";
            }
        });

        const form = document.getElementById("municipalityForm");
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            if (isEdit) {
                this.updateMunicipality(municipalityName);
            } else {
                this.createMunicipality();
            }
        });

        if (isEdit) {
            this.loadMunicipalityData(municipalityName);
        }
    }

    async loadMunicipalityData(municipalityName) {
        try {
            const response = await fetch("/data/municipalities.json");
            const data = await response.json();
            const municipality = data.municipalities.find(
                (m) => m.name === municipalityName,
            );

            if (municipality) {
                document.getElementById("municipalityName").value =
                    municipality.name;
                document.getElementById("municipalityCountry").value =
                    municipality.country;
                document.getElementById("municipalityCode").value =
                    municipality.code;
                document.getElementById("municipalityPopulation").value =
                    municipality.population || "";
                document.getElementById("municipalityArea").value =
                    municipality.area || "";
                document.getElementById("municipalityPlaces").value =
                    municipality.largest_places
                        ? municipality.largest_places.join(", ")
                        : "";
            }
        } catch (error) {
            console.error("Error loading municipality data:", error);
            alert("Fout bij het laden van gemeente gegevens");
        }
    }

    async createMunicipality() {
        const formData = new FormData(
            document.getElementById("municipalityForm"),
        );
        const municipalityData = {
            name: formData.get("name"),
            country: formData.get("country"),
            code: formData.get("code"),
            population: formData.get("population"),
            area: formData.get("area"),
            largest_places: formData.get("largest_places"),
        };

        try {
            const response = await fetch("/admin/api/municipalities", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.token}`,
                },
                body: JSON.stringify(municipalityData),
            });

            const result = await response.json();

            if (response.ok) {
                closeModal("municipalityModal");
                this.loadMunicipalities();
            } else {
                alert(`Fout: ${result.message || "Onbekende fout"}`);
            }
        } catch (error) {
            console.error("Error creating municipality:", error);
            alert("Fout bij het toevoegen van gemeente");
        }
    }

    async updateMunicipality(municipalityName) {
        const formData = new FormData(
            document.getElementById("municipalityForm"),
        );
        const municipalityData = {
            name: formData.get("name"),
            country: formData.get("country"),
            code: formData.get("code"),
            population: formData.get("population"),
            area: formData.get("area"),
            largest_places: formData.get("largest_places"),
        };

        try {
            const response = await fetch(
                `/admin/api/municipalities/${encodeURIComponent(municipalityName)}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${this.token}`,
                    },
                    body: JSON.stringify(municipalityData),
                },
            );

            const result = await response.json();

            if (response.ok) {
                closeModal("municipalityModal");
                this.loadMunicipalities();
            } else {
                alert(`Fout: ${result.message || "Onbekende fout"}`);
            }
        } catch (error) {
            console.error("Error updating municipality:", error);
            alert("Fout bij het bijwerken van gemeente");
        }
    }

    async deleteMunicipality(municipalityName) {
        if (this.userRole !== "admin") {
            alert("Alleen administrators kunnen gemeenten verwijderen.");
            return;
        }

        try {
            const response = await fetch(
                `/admin/api/municipalities/${encodeURIComponent(municipalityName)}`,
                {
                    method: "DELETE",
                    headers: {
                        Authorization: `Bearer ${this.token}`,
                    },
                },
            );

            const result = await response.json();

            if (response.ok) {
                this.loadMunicipalities();
            } else {
                alert(`Fout: ${result.message || "Onbekende fout"}`);
            }
        } catch (error) {
            console.error("Error deleting municipality:", error);
            alert("Fout bij het verwijderen van gemeente");
        }
    }

    openFilterModal(category, existingItem = null) {
        const isEdit = existingItem !== null;

        const modalHTML = `
            <div id="filterModal" class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>${isEdit ? "Filter item bewerken" : "Nieuw filter item toevoegen"} - ${this.getCategoryDisplayName(category)}</h3>
                        <button class="modal-close" onclick="closeModal('filterModal')">×</button>
                    </div>
                    <form id="filterForm" class="modal-form">
                        <div class="form-group">
                            <label for="filterItem">Filter item *</label>
                            <input type="text" id="filterItem" name="item" required value="${existingItem || ""}">
                        </div>
                        <div class="modal-actions">
                            <button type="button" class="btn btn-secondary" onclick="closeModal('filterModal')">Annuleren</button>
                            <button type="submit" class="btn btn-primary">${isEdit ? "Opslaan" : "Toevoegen"}</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML("beforeend", modalHTML);

        const form = document.getElementById("filterForm");
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            if (isEdit) {
                this.updateFilterItem(category, existingItem);
            } else {
                this.createFilterItem(category);
            }
        });
    }

    async deleteFilterItem(category, item) {
        if (this.userRole !== "admin") {
            alert("Alleen administrators kunnen filter items verwijderen.");
            return;
        }

        if (!confirm(`Weet je zeker dat je "${item}" wilt verwijderen?`)) {
            return;
        }

        try {
            const response = await fetch(
                `/admin/api/filters/${category}/${encodeURIComponent(item)}`,
                {
                    method: "DELETE",
                    headers: {
                        Authorization: `Bearer ${this.token}`,
                    },
                },
            );

            const result = await response.json();

            if (response.ok) {
                this.loadFilters();
            } else {
                alert(`Fout: ${result.message || "Onbekende fout"}`);
            }
        } catch (error) {
            console.error("Error deleting filter item:", error);
            alert("Fout bij het verwijderen van filter item");
        }
    }

    // Filter Management Functions
    openAddFilterItemModal(containerId) {
        const categoryMap = {
            projectTypesFilter: "ProjectType",
            organizationTypesFilter: "OrganizationType",
            hbmTopicsFilter: "HBMTopic",
            hbmSectorsFilter: "HBMSector",
        };

        const category = categoryMap[containerId];
        const categoryDisplayName = {
            ProjectType: "Project Types",
            OrganizationType: "Organisatie Types",
            HBMTopic: "HBM Topics",
            HBMSector: "HBM Sectoren",
        }[category];

        const modalHTML = `
            <div id="filterModal" class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Nieuw filter item toevoegen - ${categoryDisplayName}</h3>
                        <button class="modal-close" onclick="closeModal('filterModal')">×</button>
                    </div>
                    <form id="filterForm" class="modal-form">
                        <div class="form-group">
                            <label for="filterItem">Filter item *</label>
                            <input type="text" id="filterItem" name="item" required>
                        </div>
                        <div class="modal-actions">
                            <button type="button" class="btn btn-secondary" onclick="closeModal('filterModal')">Annuleren</button>
                            <button type="submit" class="btn btn-primary">Toevoegen</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML("beforeend", modalHTML);

        const form = document.getElementById("filterForm");
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            this.createFilterItem(category);
        });
    }

    openEditFilterItemModal(containerId, item) {
        const categoryMap = {
            projectTypesFilter: "ProjectType",
            organizationTypesFilter: "OrganizationType",
            hbmTopicsFilter: "HBMTopic",
            hbmSectorsFilter: "HBMSector",
        };

        const category = categoryMap[containerId];
        const categoryDisplayName = {
            ProjectType: "Project Types",
            OrganizationType: "Organisatie Types",
            HBMTopic: "HBM Topics",
            HBMSector: "HBM Sectoren",
        }[category];

        const modalHTML = `
            <div id="filterModal" class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Filter item bewerken - ${categoryDisplayName}</h3>
                        <button class="modal-close" onclick="closeModal('filterModal')">×</button>
                    </div>
                    <form id="filterForm" class="modal-form">
                        <div class="form-group">
                            <label for="filterItem">Filter item *</label>
                            <input type="text" id="filterItem" name="item" required value="${item}">
                        </div>
                        <div class="modal-actions">
                            <button type="button" class="btn btn-secondary" onclick="closeModal('filterModal')">Annuleren</button>
                            <button type="submit" class="btn btn-primary">Opslaan</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML("beforeend", modalHTML);

        const form = document.getElementById("filterForm");
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            this.updateFilterItem(category, item);
        });
    }

    async createFilterItem(category) {
        const formData = new FormData(document.getElementById("filterForm"));
        const itemData = {
            item: formData.get("item"),
        };

        try {
            const response = await fetch(`/admin/api/filters/${category}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.token}`,
                },
                body: JSON.stringify(itemData),
            });

            const result = await response.json();

            if (response.ok) {
                closeModal("filterModal");
                this.loadFilters();
            } else {
                alert(`Fout: ${result.message || "Onbekende fout"}`);
            }
        } catch (error) {
            console.error("Error creating filter item:", error);
            alert("Fout bij het toevoegen van filter item");
        }
    }

    async updateFilterItem(category, oldItem) {
        const formData = new FormData(document.getElementById("filterForm"));
        const itemData = {
            item: formData.get("item"),
        };

        try {
            const response = await fetch(
                `/admin/api/filters/${category}/${encodeURIComponent(oldItem)}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${this.token}`,
                    },
                    body: JSON.stringify(itemData),
                },
            );

            const result = await response.json();

            if (response.ok) {
                closeModal("filterModal");
                this.loadFilters();
            } else {
                alert(`Fout: ${result.message || "Onbekende fout"}`);
            }
        } catch (error) {
            console.error("Error updating filter item:", error);
            alert("Fout bij het bijwerken van filter item");
        }
    }

    getCategoryDisplayName(category) {
        const categoryDisplayNames = {
            ProjectType: "Project Types",
            OrganizationType: "Organisatie Types",
            HBMTopic: "HBM Topics",
            HBMSector: "HBM Sectoren",
        };
        return categoryDisplayNames[category] || category;
    }

    // Translation mappings for English to Dutch
    getTranslationMappings() {
        return {
            OrganizationType: {
                Designer: "Architect2",
                Contractor: "Aannemer",
                Supplier: "Leverancier",
                "Research Institute": "Onderzoeksinstelling",
                Government: "Overheid / non-profit",
            },
            ProjectType: {
                "Feasibility Study": "Haalbaarheidsstudie / Concept",
                "Initiative & Vision Development":
                    "Initiatief & Visie Ontwikkeling",
                Design: "Ontwerp",
                "Tender & Selection": "Aanbesteding & selectie",
                "Construction & Realization": "Constructie & Realisatie",
                "Installation & Commissioning":
                    "Inrichting & Inbedrijfstelling",
                "Use & Management": "Gebruik & Beheer",
                "Aftercare / Monitoring": "Nazorg / Monitoring",
                Renovation: "Renovatie",
                "Demolition & Redevelopment": "Sloop & Herontwikkeling",
            },
            HBMTopic: {
                Acoustics: "Akoestiek",
                "Active Design": "Actief Ontwerp",
                "Indoor Air Quality": "Binnenluchtkwaliteit",
                Light: "Licht",
                "Look & Feel": "Uiterlijk & Gevoel",
                "Thermal Comfort": "Thermisch Comfort",
            },
            HBMCharacteristics: {
                "Bio-based materials": "Biobased materialen",
                "Biophilic design": "Biofiel ontwerp",
                Certification: "Certificering",
                Circular: "Circulair",
                "Climate adaptive": "Klimaatadaptief",
                "Design for disassembly": "Ontwerp voor demontage",
                Education: "Onderwijs",
                "Green roofs": "Groene daken",
                "Inclusive design": "Inclusief ontwerp",
                "Life cycle analysis (LCA)": "Levenscyclusanalyse (LCA)",
                "Low carbon": "Koolstofarm",
                "Low EMF": "Laag-EMV",
                "Low VOC": "Laag-VOS",
                "Nature inclusive": "Natuurinclusief",
                "Net zero energy": "Netto-nul energie",
                "Passive house": "Passiefhuis",
                "Prefab & modular construction": "Prefab & modulaire bouw",
                Scientific: "Wetenschappelijk",
                Sensors: "Sensoren",
            },
            HBMSector: {
                Education: "Onderwijs",
                Government: "Overheid",
                Healthcare: "Zorg",
                Hospitality: "Horeca",
                Living: "Wonen",
                Recreation: "Recreatie",
                Office: "Kantoor",
            },
        };
    }

    // Translate English values to Dutch
    translateValue(category, englishValue) {
        const mappings = this.getTranslationMappings();
        if (mappings[category] && mappings[category][englishValue]) {
            return mappings[category][englishValue];
        }
        return englishValue; // Return original if no translation found
    }

    // Translate array of comma-separated values
    translateCommaSeparatedValues(category, commaSeparatedString) {
        if (!commaSeparatedString) return null;

        const values = commaSeparatedString.split(",").map((v) => v.trim());
        const translatedValues = values.map((value) =>
            this.translateValue(category, value),
        );

        return translatedValues.length === 1
            ? translatedValues[0]
            : translatedValues;
    }

    // Open import modal
    openImportModal() {
        const modalHTML = `
            <div id="importModal" class="modal-overlay">
                <div class="modal-content" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
                    <div class="modal-header">
                        <h3>Import XLS Bestand</h3>
                        <button class="modal-close" onclick="closeModal('importModal')">×</button>
                    </div>
                    <div class="modal-body">
                        <div style="margin-bottom: 1rem; padding: 1rem; background: #f8f9fa; border-radius: 4px;">
                            <h4>Instructies:</h4>
                            <ul style="margin: 0.5rem 0; padding-left: 1.5rem;">
                                <li>Selecteer een XLS of XLSX bestand</li>
                                <li>Alleen records met status 'Approved' worden geïmporteerd</li>
                                <li>Bestaande kansen worden bijgewerkt op basis van de naam</li>
                                <li>Nieuwe gemeenten worden automatisch toegevoegd</li>
                                <li>Engelse waarden worden automatisch vertaald naar Nederlands</li>
                                <li>Adressen worden automatisch gecodeerd naar coördinaten</li>
                            </ul>
                        </div>

                        <div class="form-group">
                            <label for="importFile">Selecteer XLS/XLSX bestand *</label>
                            <input type="file" id="importFile" accept=".xls,.xlsx" required style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
                            <small style="color: #666; font-size: 0.8rem; margin-top: 0.25rem; display: block;">
                                Ondersteunde formaten: .xlsx, .xls (max 10MB)
                            </small>
                        </div>

                        <div id="importProgress" style="display: none; margin-top: 1rem;">
                            <div style="background: #e9ecef; border-radius: 4px; overflow: hidden;">
                                <div id="importProgressBar" style="height: 20px; background: #007bff; width: 0%; transition: width 0.3s;"></div>
                            </div>
                            <div id="importStatus" style="margin-top: 0.5rem; font-size: 0.9rem; color: #666;"></div>
                        </div>

                        <div id="importResults" style="display: none; margin-top: 1rem; padding: 1rem; border-radius: 4px;"></div>
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn btn-secondary" onclick="closeModal('importModal')">Annuleren</button>
                        <button type="button" class="btn btn-primary" onclick="adminApp.processImport()">Import Starten</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML("beforeend", modalHTML);
    }

    // Process import
    async processImport() {
        const fileInput = document.getElementById("importFile");
        const file = fileInput.files[0];

        if (!file) {
            alert("Selecteer eerst een bestand");
            return;
        }

        console.log(
            "Starting import process for file:",
            file.name,
            "Size:",
            file.size,
            "Type:",
            file.type,
        );

        const progressContainer = document.getElementById("importProgress");
        const progressBar = document.getElementById("importProgressBar");
        const statusDiv = document.getElementById("importStatus");
        const resultsDiv = document.getElementById("importResults");

        progressContainer.style.display = "block";
        resultsDiv.style.display = "none";

        try {
            // Validate file type
            if (!file.name.toLowerCase().match(/\.(xlsx|xls)$/)) {
                throw new Error(
                    "Alleen Excel bestanden (.xlsx, .xls) worden ondersteund",
                );
            }

            // Validate file size (max 10MB)
            if (file.size > 10 * 1024 * 1024) {
                throw new Error(
                    "Bestand is te groot. Maximum grootte is 10MB.",
                );
            }

            // Update progress
            this.updateImportProgress(5, "Bestand wordt gecontroleerd...");

            // Small delay to show progress
            await new Promise((resolve) => setTimeout(resolve, 200));

            this.updateImportProgress(8, "Excel library wordt geladen...");

            // Ensure XLSX library is loaded first
            await this.ensureXLSXLoaded();

            this.updateImportProgress(15, "Bestand wordt gelezen...");

            // Read file
            const data = await this.readExcelFile(file);
            console.log("File read successfully, processing data...");

            this.updateImportProgress(30, "Data wordt gevalideerd...");

            // Process data
            const processedData = await this.processImportData(data);
            this.updateImportProgress(90, "Import wordt afgerond...");

            // Show results
            this.showImportResults(processedData);
            this.updateImportProgress(100, "Import voltooid!");

            // Reload opportunities
            await this.loadOpportunities();
        } catch (error) {
            console.error("Import error:", error);
            this.updateImportProgress(0, "Fout opgetreden");
            resultsDiv.innerHTML = `<div style="color: #dc3545; padding: 1rem; background: #f8d7da; border-radius: 4px;">
                <strong>Fout bij import:</strong> ${error.message}<br>
                <small>Controleer of het bestand correct is en probeer opnieuw.</small>
            </div>`;
            resultsDiv.style.display = "block";
            progressContainer.style.display = "none";
        }
    }

    // Update import progress
    updateImportProgress(percentage, status) {
        const progressBar = document.getElementById("importProgressBar");
        const statusDiv = document.getElementById("importStatus");

        if (progressBar) progressBar.style.width = percentage + "%";
        if (statusDiv) statusDiv.textContent = status;
    }

    // Read Excel file
    async readExcelFile(file) {
        return new Promise((resolve, reject) => {
            // First ensure XLSX library is loaded
            this.ensureXLSXLoaded()
                .then(() => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        try {
                            console.log("File read, parsing Excel data...");
                            this.parseExcelData(
                                e.target.result,
                                resolve,
                                reject,
                            );
                        } catch (error) {
                            console.error("Error in readExcelFile:", error);
                            reject(error);
                        }
                    };
                    reader.onerror = () => {
                        console.error("FileReader error");
                        reject(new Error("Fout bij lezen van bestand"));
                    };
                    reader.readAsArrayBuffer(file);
                })
                .catch((error) => {
                    console.error("Failed to load XLSX library:", error);
                    reject(
                        new Error(
                            "Fout bij laden van Excel library. Controleer je internetverbinding en probeer opnieuw.",
                        ),
                    );
                });
        });
    }

    // Ensure XLSX library is loaded
    ensureXLSXLoaded() {
        return new Promise((resolve, reject) => {
            if (typeof XLSX !== "undefined") {
                console.log("XLSX library already available");
                resolve();
                return;
            }

            console.log("Loading XLSX library...");

            // Try multiple CDN sources for better reliability
            const cdnUrls = [
                "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
                "https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js",
                "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",
            ];

            let currentIndex = 0;

            const tryLoadScript = () => {
                if (currentIndex >= cdnUrls.length) {
                    reject(new Error("Alle Excel library bronnen gefaald"));
                    return;
                }

                const script = document.createElement("script");
                script.src = cdnUrls[currentIndex];

                script.onload = () => {
                    console.log(
                        `XLSX library loaded successfully from: ${cdnUrls[currentIndex]}`,
                    );
                    // Add small delay to ensure library is fully initialized
                    setTimeout(() => {
                        if (typeof XLSX !== "undefined") {
                            console.log("XLSX version:", XLSX.version);
                            resolve();
                        } else {
                            console.error(
                                "XLSX still undefined after script load",
                            );
                            currentIndex++;
                            tryLoadScript();
                        }
                    }, 200);
                };

                script.onerror = () => {
                    console.error(
                        `Failed to load XLSX from: ${cdnUrls[currentIndex]}`,
                    );
                    currentIndex++;
                    tryLoadScript();
                };

                // Set timeout for script loading
                setTimeout(() => {
                    if (typeof XLSX === "undefined") {
                        console.error(
                            `Timeout loading XLSX from: ${cdnUrls[currentIndex]}`,
                        );
                        script.onerror();
                    }
                }, 10000);

                document.head.appendChild(script);
            };

            tryLoadScript();
        });
    }

    // Parse Excel data
    parseExcelData(data, resolve, reject) {
        try {
            console.log("Starting Excel parsing...");

            if (typeof XLSX === "undefined") {
                reject(
                    new Error(
                        "XLSX library is niet beschikbaar. Herlaad de pagina en probeer opnieuw.",
                    ),
                );
                return;
            }

            console.log("Reading workbook...");

            // Try different read options for better compatibility
            let workbook;
            try {
                workbook = XLSX.read(data, {
                    type: "array",
                    cellDates: true,
                    cellNF: false,
                    cellText: false,
                });
            } catch (firstError) {
                console.log(
                    "First read attempt failed, trying alternative method...",
                );
                try {
                    workbook = XLSX.read(data, {
                        type: "buffer",
                        cellDates: true,
                    });
                } catch (secondError) {
                    console.log(
                        "Second read attempt failed, trying basic method...",
                    );
                    workbook = XLSX.read(data, { type: "array" });
                }
            }

            console.log("Workbook sheets:", workbook.SheetNames);

            if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
                reject(
                    new Error(
                        "Geen werkbladen gevonden in het Excel bestand. Controleer of het bestand geldig is.",
                    ),
                );
                return;
            }

            // Look for 'Data' sheet first, fallback to first sheet
            let targetSheetName = null;
            if (workbook.SheetNames.includes("Data")) {
                targetSheetName = "Data";
                console.log("Found 'Data' sheet, using it for import");
            } else {
                targetSheetName = workbook.SheetNames[0];
                console.log(
                    "No 'Data' sheet found, using first sheet:",
                    targetSheetName,
                );
            }

            const worksheet = workbook.Sheets[targetSheetName];

            if (!worksheet) {
                reject(
                    new Error(
                        "Werkblad kon niet worden gelezen. Controleer of het Excel bestand geldig is.",
                    ),
                );
                return;
            }

            // Convert to JSON with more options for better data handling
            const jsonData = XLSX.utils.sheet_to_json(worksheet, {
                header: 1,
                defval: "",
                blankrows: false,
                raw: false,
            });

            console.log("Raw data rows:", jsonData.length);

            if (jsonData.length < 2) {
                reject(
                    new Error(
                        "Excel bestand bevat geen data. Controleer of er data in het bestand staat.",
                    ),
                );
                return;
            }

            // Log first few rows for debugging (but limit to avoid console spam)
            console.log("First 3 rows:", jsonData.slice(0, 3));

            // Skip header row and filter for approved records
            const dataRows = jsonData
                .slice(1)
                .filter((row) =>
                    row.some((cell) => cell !== null && cell !== ""),
                );

            // Debug: log first few status values
            console.log(
                "First 10 status values:",
                dataRows.slice(0, 10).map((row) => row[0]),
            );

            const approvedRecords = dataRows.filter((row) => {
                const status = row[0]
                    ? row[0].toString().toLowerCase().trim()
                    : "";
                console.log(
                    `Row status: '${row[0]}' -> normalized: '${status}'`,
                );
                return status === "approved";
            });

            console.log(
                `Found ${approvedRecords.length} approved records out of ${dataRows.length} total rows`,
            );

            // More detailed error message
            if (approvedRecords.length === 0) {
                const uniqueStatuses = [
                    ...new Set(
                        dataRows
                            .map((row) => row[0])
                            .filter(
                                (status) => status !== null && status !== "",
                            ),
                    ),
                ];
                reject(
                    new Error(
                        `Geen records met status 'Approved' gevonden in het bestand. Gevonden statuswaarden in eerste kolom: ${uniqueStatuses.join(", ")}. Controleer of er records zijn met exact de tekst 'Approved' in de eerste kolom.`,
                    ),
                );
                return;
            }

            resolve(approvedRecords);
        } catch (error) {
            console.error("Excel parsing error:", error);

            // More specific error messages
            if (error.message.includes("corrupted")) {
                reject(
                    new Error(
                        "Excel bestand is beschadigd. Probeer het bestand opnieuw op te slaan.",
                    ),
                );
            } else if (error.message.includes("format")) {
                reject(
                    new Error(
                        "Excel bestand formaat wordt niet ondersteund. Gebruik .xlsx of .xls bestand.",
                    ),
                );
            } else {
                reject(
                    new Error(
                        "Fout bij verwerken van Excel data: " +
                            error.message +
                            ". Controleer of het bestand geldig is.",
                    ),
                );
            }
        }
    }

    // Process import data
    async processImportData(data) {
        const results = {
            total: data.length,
            added: 0,
            updated: 0,
            failed: 0,
            errors: [],
        };

        for (let i = 0; i < data.length; i++) {
            const row = data[i];

            try {
                this.updateImportProgress(
                    20 + (i / data.length) * 60,
                    `Verwerken record ${i + 1} van ${data.length}...`,
                );

                // Log raw row data for debugging
                console.log(`Processing row ${i + 1}:`, row);

                const opportunity = await this.processOpportunityRow(row);

                if (opportunity) {
                    console.log(`Processed opportunity for row ${i + 1}:`, {
                        name: opportunity.Name,
                        type: opportunity.HBMType,
                        municipality: opportunity.Municipality,
                    });

                    // Check if opportunity exists by name
                    const existingOpportunity = this.allOpportunities.find(
                        (o) => o.Name === opportunity.Name,
                    );

                    if (existingOpportunity) {
                        await this.updateExistingOpportunity(opportunity);
                        results.updated++;
                        console.log(
                            `Updated existing opportunity: ${opportunity.Name}`,
                        );
                    } else {
                        await this.createNewOpportunity(opportunity);
                        results.added++;
                        console.log(
                            `Created new opportunity: ${opportunity.Name}`,
                        );
                    }
                } else {
                    console.log(
                        `Row ${i + 1} skipped (HBMUse = internal or missing data)`,
                    );
                }
            } catch (error) {
                console.error(`Error processing row ${i + 1}:`, {
                    error: error,
                    errorMessage: error.message,
                    errorStack: error.stack,
                    rowData: row,
                });
                results.failed++;
                results.errors.push(`Rij ${i + 1}: ${error.message}`);
            }
        }

        return results;
    }

    // Process single opportunity row
    async processOpportunityRow(row) {
        try {
            console.log(
                `Processing opportunity row with ${row.length} columns:`,
                row,
            );

            // Validate row has minimum required data
            if (!row || row.length < 12) {
                throw new Error(
                    `Row has insufficient data: ${row.length} columns found, minimum 12 required`,
                );
            }

            // Validate required fields and clean up the name
            let opportunityName = (row[1] || "").toString().trim();
            if (!opportunityName || opportunityName === "") {
                throw new Error(
                    `Missing required field: Name (column 1) is empty`,
                );
            }

            // Skip test/demo entries that might cause issues
            if (
                opportunityName.toLowerCase().includes("example") ||
                opportunityName.toLowerCase().includes("test")
            ) {
                console.log(
                    `Skipping test/demo opportunity: ${opportunityName}`,
                );
                return null;
            }

            // Clean up the name to remove any problematic characters
            opportunityName = opportunityName
                .replace(/[^\w\s\-\(\)\.]/g, "")
                .trim();
            if (!opportunityName) {
                throw new Error(
                    `Invalid opportunity name after cleanup: "${row[1]}"`,
                );
            }

            // Map columns to opportunity object
            const opportunity = {
                Name: opportunityName,
                Address: (row[2] || "").toString().trim(),
                PostalCode: (row[3] || "").toString().trim(),
                City: (row[4] || "").toString().trim(),
                Country: (row[5] || "").toString().trim(),
                Municipality: (row[6] || "").toString().trim(),
                OrganizationType: this.translateCommaSeparatedValues(
                    "OrganizationType",
                    row[7],
                ),
                ProjectType: this.translateCommaSeparatedValues(
                    "ProjectType",
                    row[8],
                ),
                ProjectPhase: (row[9] || "").toString().trim(),
                HBMUse: (row[10] || "").toString().trim(),
                HBMType: (row[11] || "").toString().trim(),
                HBMTopic: this.translateCommaSeparatedValues(
                    "HBMTopic",
                    row[12],
                ),
                HBMCharacteristics: this.translateCommaSeparatedValues(
                    "HBMCharacteristics",
                    row[13],
                ),
                HBMSector: this.translateCommaSeparatedValues(
                    "HBMSector",
                    row[14],
                ),
                ContactPerson: (row[15] || "").toString().trim(),
                ContactEmail: (row[16] || "").toString().trim(),
                ContactPhone: (row[17] || "").toString().trim(),
                ContactWebsite: (row[18] || "").toString().trim(),
                Latitude: row[19] ? parseFloat(row[19]) : null,
                Longitude: row[20] ? parseFloat(row[20]) : null,
                Remarks: (row[21] || "").toString().trim(),
            };

            console.log(`Mapped opportunity object:`, opportunity);

            //Validate that we have enough data to create a meaningful opportunity
            if (
                !opportunity.HBMType ||
                (!opportunity.City)
            ) {
                console.log(
                    `Skipping opportunity ${opportunity.Name} - insufficient location or type data`,
                );
                return null;
            }

            // Add municipality if it doesn't exist
            if (opportunity.Municipality) {
                await this.ensureMunicipalityExists(
                    opportunity.Municipality,
                    opportunity.Country,
                );
            }

            // Geocode if coordinates are missing
            if (!opportunity.Latitude || !opportunity.Longitude) {
                if (opportunity.Address && opportunity.City) {
                    console.log(
                        `Geocoding address for ${opportunity.Name}: ${opportunity.Address}, ${opportunity.PostalCode} ${opportunity.City}, ${opportunity.Country}`,
                    );
                    const coords = await this.geocodeAddress(
                        `${opportunity.Address}, ${opportunity.PostalCode} ${opportunity.City}, ${opportunity.Country}`,
                    );
                    if (coords) {
                        opportunity.Latitude = coords.lat;
                        opportunity.Longitude = coords.lng;
                        console.log(
                            `Geocoded coordinates: ${coords.lat}, ${coords.lng}`,
                        );
                    }
                }
            }

            return opportunity;
        } catch (error) {
            console.error(`Error in processOpportunityRow:`, {
                error: error.message,
                stack: error.stack,
                rowData: row,
            });
            throw error;
        }
    }

    // Ensure municipality exists
    async ensureMunicipalityExists(municipalityName, country) {
        try {
            const response = await fetch("/admin/api/municipalities", {
                headers: {
                    Authorization: `Bearer ${this.token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                const existingMunicipality = data.municipalities.find(
                    (m) => m.name === municipalityName,
                );

                if (!existingMunicipality) {
                    // Create new municipality
                    const municipalityData = {
                        name: municipalityName,
                        country:
                            country === "NL"
                                ? "Netherlands"
                                : country === "DE"
                                  ? "Germany"
                                  : country,
                        code:
                            country === "NL"
                                ? "NL"
                                : country === "DE"
                                  ? "DE"
                                  : country,
                        visibility: false, // New municipalities start as not visible
                    };

                    await fetch("/admin/api/municipalities", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${this.token}`,
                        },
                        body: JSON.stringify(municipalityData),
                    });
                }
            }
        } catch (error) {
            console.error("Error ensuring municipality exists:", error);
        }
    }

    // Geocode address
    async geocodeAddress(address) {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
            );
            const data = await response.json();

            if (data && data.length > 0) {
                return {
                    lat: parseFloat(data[0].lat),
                    lng: parseFloat(data[0].lon),
                };
            }
        } catch (error) {
            console.error("Geocoding error:", error);
        }
        return null;
    }

    // Update existing opportunity
    async updateExistingOpportunity(opportunity) {
        const response = await fetch(
            `/admin/api/opportunities/${encodeURIComponent(opportunity.Name)}`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.token}`,
                },
                body: JSON.stringify(opportunity),
            },
        );

        if (!response.ok) {
            throw new Error(
                `Failed to update opportunity: ${opportunity.Name}`,
            );
        }
    }

    // Create new opportunity
    async createNewOpportunity(opportunity) {
        try {
            console.log(`Creating new opportunity:`, {
                name: opportunity.Name,
                data: opportunity,
            });

            // Additional validation before sending to API
            if (!opportunity.Name || opportunity.Name.trim() === "") {
                throw new Error("Opportunity name is required");
            }

            // Ensure required fields have default values
            const cleanOpportunity = {
                ...opportunity,
                Description:
                    opportunity.Description ||
                    `${opportunity.HBMType || "Kans"} in ${opportunity.Municipality || opportunity.City || "onbekende locatie"}`,
                HBMType: opportunity.HBMType || "Project",
            };

            const response = await fetch("/admin/api/opportunities", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.token}`,
                },
                body: JSON.stringify(cleanOpportunity),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(
                    `API Error creating opportunity ${opportunity.Name}:`,
                    {
                        status: response.status,
                        statusText: response.statusText,
                        errorText: errorText,
                    },
                );

                // More specific error handling
                if (response.status === 400) {
                    throw new Error(
                        `Validation error for ${opportunity.Name}: ${errorText}`,
                    );
                } else if (response.status === 409) {
                    throw new Error(
                        `Duplicate opportunity: ${opportunity.Name} already exists`,
                    );
                } else {
                    throw new Error(
                        `Server error creating ${opportunity.Name}: ${response.status} ${errorText}`,
                    );
                }
            }

            const result = await response.json();
            console.log(
                `Successfully created opportunity: ${opportunity.Name}`,
                result,
            );
        } catch (error) {
            console.error(
                `Exception creating opportunity ${opportunity.Name}:`,
                error,
            );
            throw new Error(
                `Failed to create opportunity "${opportunity.Name}": ${error.message}`,
            );
        }
    }

    // Show import results
    showImportResults(results) {
        const resultsDiv = document.getElementById("importResults");

        let resultHTML = `
            <div style="color: #28a745; padding: 1rem; background: #d4edda; border-radius: 4px; margin-bottom: 1rem;">
                <strong>Import voltooid!</strong>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
                <div style="text-align: center; padding: 1rem; background: #e3f2fd; border-radius: 4px;">
                    <div style="font-size: 2rem; font-weight: bold; color: #1976d2;">${results.total}</div>
                    <div>Totaal verwerkt</div>
                </div>
                <div style="text-align: center; padding: 1rem; background: #e8f5e9; border-radius: 4px;">
                    <div style="font-size: 2rem; font-weight: bold; color: #388e3c;">${results.added}</div>
                    <div>Nieuwe kansen</div>
                </div>
                <div style="text-align: center; padding: 1rem; background: #fff3e0; border-radius: 4px;">
                    <div style="font-size: 2rem; font-weight: bold; color: #f57c00;">${results.updated}</div>
                    <div>Bijgewerkt</div>
                </div>
                <div style="text-align: center; padding: 1rem; background: #ffebee; border-radius: 4px;">
                    <div style="font-size: 2rem; font-weight: bold; color: #d32f2f;">${results.failed}</div>
                    <div>Gefaald</div>
                </div>
            </div>
        `;

        if (results.errors.length > 0) {
            resultHTML += `
                <div style="margin-top: 1rem;">
                    <h4>Fouten tijdens import:</h4>
                    <div style="max-height: 200px; overflow-y: auto; padding: 1rem; background: #f8f9fa; border-radius: 4px;">
                        ${results.errors.map((error) => `<div style="margin-bottom: 0.5rem; color: #dc3545;">${error}</div>`).join("")}
                    </div>
                </div>
            `;
        }

        resultsDiv.innerHTML = resultHTML;
        resultsDiv.style.display = "block";
    }

    // Debug function to test XLSX library
    testXLSXLibrary() {
        console.log("Testing XLSX library availability...");

        if (typeof XLSX !== "undefined") {
            console.log("✅ XLSX library is available");
            console.log("XLSX version:", XLSX.version);
            return true;
        } else {
            console.log(
                "❌ XLSX library is not available, attempting to load...",
            );

            const script = document.createElement("script");
            script.src =
                "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
            script.onload = () => {
                console.log("✅ XLSX library loaded successfully");
                console.log("XLSX version:", XLSX.version);
            };
            script.onerror = () => {
                console.error("❌ Failed to load XLSX library");
            };
            document.head.appendChild(script);

            return false;
        }
    }

    // Simple resource update function
    async updateResources() {
        if (this.userRole !== "admin") {
            alert("Alleen administrators kunnen resources updaten.");
            return;
        }

        if (
            !confirm(
                "Weet je zeker dat je de nieuwste versies van Leaflet en MarkerCluster wilt downloaden?",
            )
        ) {
            return;
        }

        const updateResourcesBtn =
            document.getElementById("updateResourcesBtn");
        const leafletStatus = document.getElementById("leafletStatus");
        const markerclusterStatus = document.getElementById(
            "markerclusterStatus",
        );

        // Update UI to show progress
        if (updateResourcesBtn) {
            updateResourcesBtn.disabled = true;
            updateResourcesBtn.textContent = "Downloaden...";
        }

        if (leafletStatus)
            leafletStatus.innerHTML = `<span style="color: #007bff;">Downloaden...</span>`;
        if (markerclusterStatus)
            markerclusterStatus.innerHTML = `<span style="color: #007bff;">Downloaden...</span>`;

        try {
            const response = await fetch("/admin/api/update-resources", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${this.token}`,
                },
            });

            const data = await response.json();

            if (response.ok && data.success) {
                alert(
                    "Resources succesvol gedownload! Herlaad de pagina om de nieuwe versies te gebruiken.",
                );

                if (leafletStatus)
                    leafletStatus.innerHTML = `<span style="color: #28a745; font-weight: bold;">✓ Geüpdatet naar nieuwste versie</span>`;
                if (markerclusterStatus)
                    markerclusterStatus.innerHTML = `<span style="color: #28a745; font-weight: bold;">✓ Geüpdatet naar nieuwste versie</span>`;
            } else {
                throw new Error(data.message || "Update failed");
            }
        } catch (error) {
            console.error("Error updating resources:", error);
            alert(`Fout bij het updaten van resources: ${error.message}`);

            if (leafletStatus)
                leafletStatus.innerHTML = `<span style="color: #dc3545;">Download gefaald</span>`;
            if (markerclusterStatus)
                markerclusterStatus.innerHTML = `<span style="color: #dc3545;">Download gefaald</span>`;
        } finally {
            if (updateResourcesBtn) {
                updateResourcesBtn.disabled = false;
                updateResourcesBtn.textContent = "Download nieuwste versies";
            }
        }
    }

    // Simple check function that just shows current status and allows update
    async checkResourceUpdates() {
        if (this.userRole !== "admin") {
            alert("Alleen administrators kunnen resource updates controleren.");
            return;
        }

        const updateResourcesBtn =
            document.getElementById("updateResourcesBtn");
        const leafletStatus = document.getElementById("leafletStatus");
        const markerclusterStatus = document.getElementById(
            "markerclusterStatus",
        );

        // Show current status and make update button visible
        if (leafletStatus) {
            leafletStatus.innerHTML = `<span style="color: #6c757d;">Lokale versie geladen - klik update voor nieuwste versie</span>`;
        }

        if (markerclusterStatus) {
            markerclusterStatus.innerHTML = `<span style="color: #6c757d;">Lokale versie geladen - klik update voor nieuwste versie</span>`;
        }

        // Always show update button
        if (updateResourcesBtn) {
            updateResourcesBtn.style.display = "inline-block";
            updateResourcesBtn.textContent = "Download nieuwste versies";
        }
    }

    async loadOpportunities() {
        try {
            const response = await fetch("/admin/api/opportunities", {
                headers: {
                    Authorization: `Bearer ${this.token}`,
                },
            });

            if (!response.ok) {
                throw new Error(
                    `Failed to load opportunities: ${response.status}`,
                );
            }

            const opportunities = await response.json();

            const tableBody = document.getElementById("opportunitiesTableBody");
            if (!tableBody) return;

            tableBody.innerHTML = "";

            // Add search functionality
            this.renderOpportunitySearch();

            // Store all opportunities for filtering
            this.allOpportunities = opportunities;
            this.filteredOpportunities = opportunities;

            this.renderOpportunityTable(opportunities);
        } catch (error) {
            console.error("Error loading opportunities:", error);
            alert("Fout bij het laden van kansen");
        }
    }

    renderOpportunitySearch() {
        const existingContainer = document.getElementById(
            "opportunitySearchContainer",
        );
        if (existingContainer) {
            existingContainer.remove();
        }

        // Add search and import container
        const section = document.getElementById("opportunities-section");
        const sectionHeader = section.querySelector(".section-header");

        const searchDiv = document.createElement("div");
        searchDiv.id = "opportunitySearchContainer";
        searchDiv.innerHTML = `
            <div style="margin: 1rem 0; display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
                <input type="text" id="opportunitySearch" placeholder="Zoek op naam, type, gemeente..." 
                       style="flex: 1; min-width: 250px; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
                <select id="opportunityTypeFilter" style="padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
                    <option value="">Alle types</option>
                    <option value="Project">Project</option>
                    <option value="Bedrijf">Bedrijf</option>
                </select>
                <button onclick="adminApp.clearOpportunityFilters()" class="btn btn-secondary">Wissen</button>
            </div>
            <div id="searchStatus" style="display: none; color: #666; font-size: 0.9rem; margin-top: 0.5rem;">
                Zoeken...
            </div>
        `;

        sectionHeader.parentNode.insertBefore(
            searchDiv,
            sectionHeader.nextSibling,
        );

        // Add event listeners with debouncing
        setTimeout(() => {
            const searchInput = document.getElementById("opportunitySearch");
            const typeFilter = document.getElementById("opportunityTypeFilter");

            if (searchInput) {
                let searchTimeout;
                searchInput.addEventListener("input", () => {
                    // Clear previous timeout
                    clearTimeout(searchTimeout);

                    // Show searching status
                    const statusDiv = document.getElementById("searchStatus");
                    if (statusDiv) {
                        statusDiv.style.display = "block";
                        statusDiv.textContent = "Zoeken...";
                    }

                    // Set new timeout for 1 second
                    searchTimeout = setTimeout(() => {
                        this.filterOpportunities();
                        // Hide status after search
                        if (statusDiv) {
                            statusDiv.style.display = "none";
                        }
                    }, 1000);
                });
            }

            if (typeFilter) {
                typeFilter.addEventListener("change", () => {
                    this.filterOpportunities();
                });
            }
        }, 100);
    }

    filterOpportunities() {
        const searchInput = document.getElementById("opportunitySearch");
        const typeFilterSelect = document.getElementById(
            "opportunityTypeFilter",
        );

        if (!searchInput || !typeFilterSelect) {
            console.error("Search elements not found");
            return;
        }

        if (!this.allOpportunities || !Array.isArray(this.allOpportunities)) {
            console.error("No opportunities data available for filtering");
            return;
        }

        const searchTerm = searchInput.value.toLowerCase().trim();
        const typeFilter = typeFilterSelect.value;

        console.log(
            `Filtering opportunities: search="${searchTerm}", type="${typeFilter}", total=${this.allOpportunities.length}`,
        );

        let filtered = this.allOpportunities.filter((opp) => {
            const matchesSearch =
                !searchTerm ||
                (opp.Name && opp.Name.toLowerCase().includes(searchTerm)) ||
                (opp.Municipality &&
                    opp.Municipality.toLowerCase().includes(searchTerm)) ||
                (opp.HBMSector &&
                    this.arrayOrStringIncludes(opp.HBMSector, searchTerm)) ||
                (opp.OrganizationType &&
                    this.arrayOrStringIncludes(
                        opp.OrganizationType,
                        searchTerm,
                    )) ||
                (opp.ProjectType &&
                    this.arrayOrStringIncludes(opp.ProjectType, searchTerm)) ||
                (opp.HBMTopic &&
                    this.arrayOrStringIncludes(opp.HBMTopic, searchTerm)) ||
                (opp.HBMCharacteristics &&
                    this.arrayOrStringIncludes(
                        opp.HBMCharacteristics,
                        searchTerm,
                    )) ||
                (opp.OrganizationField &&
                    this.arrayOrStringIncludes(
                        opp.OrganizationField,
                        searchTerm,
                    )) ||
                (opp.Description &&
                    opp.Description.toLowerCase().includes(searchTerm)) ||
                (opp.City && opp.City.toLowerCase().includes(searchTerm)) ||
                (opp.Street && opp.Street.toLowerCase().includes(searchTerm));

            const matchesType = !typeFilter || opp.HBMType === typeFilter;

            return matchesSearch && matchesType;
        });

        console.log(`Filter result: ${filtered.length} opportunities found`);

        this.filteredOpportunities = filtered;
        this.renderOpportunityTable(filtered);
    }

    arrayOrStringIncludes(value, searchTerm) {
        if (!value) return false;

        if (Array.isArray(value)) {
            return value.some(
                (item) =>
                    item && item.toString().toLowerCase().includes(searchTerm),
            );
        } else {
            return value.toString().toLowerCase().includes(searchTerm);
        }
    }

    clearOpportunityFilters() {
        document.getElementById("opportunitySearch").value = "";
        document.getElementById("opportunityTypeFilter").value = "";
        this.filteredOpportunities = this.allOpportunities;
        this.renderOpportunityTable(this.allOpportunities);
    }

    renderOpportunityTable(opportunities) {
        const tableBody = document.getElementById("opportunitiesTableBody");
        tableBody.innerHTML = "";

        if (opportunities.length === 0) {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td colspan="8" style="text-align: center; padding: 2rem; color: #666;">
                    Geen kansen gevonden
                </td>
            `;
            tableBody.appendChild(row);
            return;
        }

        opportunities.forEach((opportunity) => {
            const row = document.createElement("tr");
            if (opportunity.HBMUse === "internal") {
                row.style.backgroundColor = "#f0f0f0";
            }
            row.innerHTML = `
                <td>${opportunity.Name || "Onbekend"}</td>
                <td>
                    <span class="type-badge ${(opportunity.HBMType || "").toLowerCase()}">${opportunity.HBMType || "Onbekend"}</span>
                </td>
                <td>${opportunity.Municipality || "Onbekend"}</td>
                <td>${this.formatArrayValue(opportunity.HBMSector)}</td>
                <td>${this.formatArrayValue(opportunity.OrganizationType)}</td>
                <td>
                    <button class="action-btn edit-btn" onclick="adminApp.openOpportunityModal('${this.escapeHtml(opportunity.Name)}')" title="Bewerken"><img src="/admin/icons/edit.svg" alt="Bewerken" style="width: 14px; height: 14px;"></button>
                    <button class="action-btn filter-btn" onclick="adminApp.openFilterSelectionModal('${this.escapeHtml(opportunity.Name)}')" title="Filters"><img src="/admin/icons/filter-setting.svg" alt="Bewerken" style="width: 14px; height: 14px;"></button>
                    <button onclick="adminApp.deleteOpportunity('${this.escapeHtml(opportunity.Name)}')" class="btn btn-danger btn-sm">Verwijderen</button>
                </td>
            `;
            tableBody.appendChild(row);
        });

        // Update results count
        const resultsInfo = document.getElementById("opportunityResultsInfo");
        if (!resultsInfo) {
            const searchContainer = document.getElementById(
                "opportunitySearchContainer",
            );
            const infoDiv = document.createElement("div");
            infoDiv.id = "opportunityResultsInfo";
            infoDiv.style.cssText =
                "margin-bottom: 1rem; color: #666; font-size: 0.9rem;";
            searchContainer.appendChild(infoDiv);
        }

        document.getElementById("opportunityResultsInfo").textContent =
            `${opportunities.length} van ${this.allOpportunities.length} kansen`;
    }

    formatArrayValue(value) {
        if (Array.isArray(value)) {
            return value.join(", ");
        }
        return value || "Onbekend";
    }

    escapeHtml(text) {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    openOpportunityModal(opportunityName = null) {
        const isEdit = opportunityName !== null;

        const modalHTML = `
            <div id="opportunityModal" class="modal-overlay">
                <div class="modal-content" style="max-width: 600px; max-height: 90vh; overflow-y: auto;">
                    <div class="modal-header">
                        <h3>${isEdit ? "Kans bewerken" : "Nieuwe kans toevoegen"}</h3>
                        <button class="modal-close" onclick="closeModal('opportunityModal')">×</button>
                    </div>
                    <form id="opportunityForm" class="modal-form">
                        <div class="form-row">
                            <div class="form-group">
                                <label for="opportunityName">Naam *</label>
                                <input type="text" id="opportunityName" name="Name" required>
                            </div>
                            <div class="form-group">
                                <label for="opportunityType">Type *</label>
                                <select id="opportunityType" name="HBMType" required>
                                    <option value="">Selecteer type</option>
                                    <option value="Project">Project</option>
                                    <option value="Bedrijf">Bedrijf</option>
                                </select>
                            </div>
                        </div>

                        <div class="form-group">
                            <label for="opportunityUse">Gebruik</label>
                            <select id="opportunityUse" name="HBMUse">
                                <option value="external">External (zichtbaar in hoofdapplicatie)</option>
                                <option value="internal">Internal (alleen in CMS)</option>
                                <option value="both">Both (beide)</option>
                            </select>
                            <small style="color: #666; font-size: 0.9em;">
                                External: zichtbaar in hoofdapplicatie<br>
                                Internal: alleen zichtbaar in CMS<br>
                                Both: zichtbaar in beide
                            </small>
                        </div>

                        <div class="form-group">
                            <label for="opportunityMunicipality">Gemeente</label>
                            <select id="opportunityMunicipality" name="Municipality">
                                <option value="">Selecteer gemeente</option>
                            </select>
                            <button type="button" class="btn btn-secondary" onclick="adminApp.openNewMunicipalityModal()" style="margin-top: 0.5rem;">Nieuwe gemeente toevoegen</button>
                        </div>

                        <div class="form-group">
                            <label for="opportunityDescription">Beschrijving</label>
                            <textarea id="opportunityDescription" name="Description" rows="3"></textarea>
                        </div>

                        <div class="form-group">
                            <label>Locatie</label>
                            <div style="display: flex; gap: 0.5rem; align-items: end;">
                                <div style="flex: 1;">
                                    <label for="opportunityLat" style="font-size: 0.8em;">Latitude</label>
                                    <input type="number" id="opportunityLat" name="Latitude" step="any">
                                </div>
                                <div style="flex: 1;">
                                    <label for="opportunityLng" style="font-size: 0.8em;">Longitude</label>
                                    <input type="number" id="opportunityLng" name="Longitude" step="any">
                                </div>
                                <button type="button" class="btn btn-secondary" onclick="adminApp.openLocationPicker()" style="white-space: nowrap;">Selecteer op kaart</button>
                            </div>
                        </div>

                        <div class="form-group">
                            <label for="opportunityLogo">Logo</label>
                            <div style="display: flex; gap: 0.5rem; align-items: end;">
                                <div style="flex: 1;">
                                    <input type="text" id="opportunityLogo" name="Logo" placeholder="Logo URL of upload een bestand">
                                </div>
                                <button type="button" class="btn btn-secondary" onclick="adminApp.openLogoUploadModal()" style="white-space: nowrap;">Logo toevoegen</button>
                            </div>
                            <div id="logoPreview" style="margin-top: 0.5rem; display: none;">
                                <img id="logoPreviewImage" style="max-width: 150px; max-height: 75px; border: 1px solid #ddd; border-radius: 4px;" />
                            </div>
                            <small style="color: #666; font-size: 0.8rem;">Je kunt een URL invoeren of een bestand uploaden via de "Logo toevoegen" knop</small>
                        </div>

                        <div class="modal-actions">
                            <button type="button" class="btn btn-secondary" onclick="closeModal('opportunityModal')">Annuleren</button>
                            <button type="submit" class="btn btn-primary">${isEdit ? "Opslaan" : "Toevoegen"}</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML("beforeend", modalHTML);

        const form = document.getElementById("opportunityForm");
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            if (isEdit) {
                this.updateOpportunity(opportunityName);
            } else {
                this.createOpportunity();
            }
        });

        // Add logo URL input listener for preview
        setTimeout(() => {
            const logoInput = document.getElementById("opportunityLogo");
            if (logoInput) {
                logoInput.addEventListener("input", (e) => {
                    this.updateLogoPreview(e.target.value);
                });
            }
        }, 100);

        if (isEdit) {
            this.loadOpportunityData(opportunityName);
        } else {
            // Load municipality dropdown for new opportunities
            this.loadMunicipalityDropdown();
        }
    }

    updateLogoPreview(url) {
        const preview = document.getElementById("logoPreview");
        const previewImage = document.getElementById("logoPreviewImage");

        if (url && this.isValidImageUrl(url)) {
            previewImage.src = url;
            previewImage.onload = () => {
                preview.style.display = "block";
            };
            previewImage.onerror = () => {
                preview.style.display = "none";
            };
        } else {
            preview.style.display = "none";
        }
    }

    async loadOpportunityData(opportunityName) {
        try {
            const opportunity = this.allOpportunities.find(
                (o) => o.Name === opportunityName,
            );

            if (opportunity) {
                document.getElementById("opportunityName").value =
                    opportunity.Name || "";
                document.getElementById("opportunityType").value =
                    opportunity.HBMType || "";
                document.getElementById("opportunityUse").value =
                    opportunity.HBMUse || "";
                // Load municipality dropdown
                await this.loadMunicipalityDropdown();
                document.getElementById("opportunityMunicipality").value =
                    opportunity.Municipality || "";
                document.getElementById("opportunityDescription").value =
                    opportunity.Description || "";
                document.getElementById("opportunityLat").value =
                    opportunity.Latitude || "";
                document.getElementById("opportunityLng").value =
                    opportunity.Longitude || "";
                const logoUrl = opportunity.Logo || "";
                document.getElementById("opportunityLogo").value = logoUrl;

                // Show logo preview if URL exists
                if (logoUrl) {
                    this.updateLogoPreview(logoUrl);
                }
            }
        } catch (error) {
            console.error("Error loading opportunity data:", error);
            alert("Fout bij het laden van kans gegevens");
        }
    }

    async loadMunicipalityDropdown() {
        try {
            const response = await fetch("/admin/api/municipalities", {
                headers: {
                    Authorization: `Bearer ${this.token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                const municipalitySelect = document.getElementById(
                    "opportunityMunicipality",
                );

                if (municipalitySelect) {
                    // Clear existing options except the first one
                    municipalitySelect.innerHTML =
                        '<option value="">Selecteer gemeente</option>';

                    // Add municipalities
                    data.municipalities.forEach((municipality) => {
                        const option = document.createElement("option");
                        option.value = municipality.name;
                        option.textContent = municipality.name;
                        municipalitySelect.appendChild(option);
                    });
                }
            }
        } catch (error) {
            console.error("Error loading municipalities for dropdown:", error);
        }
    }

    openNewMunicipalityModal() {
        const modalHTML = `
            <div id="newMunicipalityModal" class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Nieuwe gemeente toevoegen</h3>
                        <button class="modal-close" onclick="closeModal('newMunicipalityModal')">×</button>
                    </div>
                    <form id="newMunicipalityForm" class="modal-form">
                        <div class="form-group">
                            <label for="newMunicipalityName">Naam *</label>
                            <input type="text" id="newMunicipalityName" name="name" required>
                        </div>
                        <div class="form-group">
                            <label for="newMunicipalityCountry">Land *</label>
                            <select id="newMunicipalityCountry" name="country" required>
                                <option value="">Selecteer land</option>
                                <option value="Netherlands">Nederland</option>
                                <option value="Germany">Duitsland</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="newMunicipalityCode">Code *</label>
                            <select id="newMunicipalityCode" name="code" required>
                                <option value="">Selecteer code</option>
                                <option value="NL">NL</option>
                                <option value="DE">DE</option>
                            </select>
                        </div>
                        <div class="modal-actions">
                            <button type="button" class="btn btn-secondary" onclick="closeModal('newMunicipalityModal')">Annuleren</button>
                            <button type="submit" class="btn btn-primary">Toevoegen</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML("beforeend", modalHTML);

        // Set up country-code synchronization
        const countrySelect = document.getElementById("newMunicipalityCountry");
        const codeSelect = document.getElementById("newMunicipalityCode");

        countrySelect.addEventListener("change", () => {
            if (countrySelect.value === "Netherlands") {
                codeSelect.value = "NL";
            } else if (countrySelect.value === "Germany") {
                codeSelect.value = "DE";
            }
        });

        codeSelect.addEventListener("change", () => {
            if (codeSelect.value === "NL") {
                countrySelect.value = "Netherlands";
            } else if (codeSelect.value === "DE") {
                countrySelect.value = "Germany";
            }
        });

        const form = document.getElementById("newMunicipalityForm");
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            this.createNewMunicipality();
        });
    }

    async createNewMunicipality() {
        const formData = new FormData(
            document.getElementById("newMunicipalityForm"),
        );
        const municipalityData = {
            name: formData.get("name"),
            country: formData.get("country"),
            code: formData.get("code"),
        };

        try {
            const response = await fetch("/admin/api/municipalities", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.token}`,
                },
                body: JSON.stringify(municipalityData),
            });

            const result = await response.json();

            if (response.ok) {
                closeModal("newMunicipalityModal");
                // Reload the municipality dropdown
                await this.loadMunicipalityDropdown();
                // Select the newly added municipality
                document.getElementById("opportunityMunicipality").value =
                    municipalityData.name;
                alert("Gemeente succesvol toegevoegd!");
            } else {
                alert(`Fout: ${result.message || "Onbekende fout"}`);
            }
        } catch (error) {
            console.error("Error creating municipality:", error);
            alert("Fout bij het toevoegen van gemeente");
        }
    }

    async createOpportunity() {
        const formData = new FormData(
            document.getElementById("opportunityForm"),
        );
        const opportunityData = {};

        for (let [key, value] of formData.entries()) {
            if (value.trim()) {
                if (key === "Latitude" || key === "Longitude") {
                    opportunityData[key] = parseFloat(value);
                } else {
                    opportunityData[key] = value;
                }
            }
        }

        try {
            const response = await fetch("/admin/api/opportunities", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.token}`,
                },
                body: JSON.stringify(opportunityData),
            });

            const result = await response.json();

            if (response.ok) {
                closeModal("opportunityModal");
                this.loadOpportunities();
                alert("Kans succesvol toegevoegd!");
            } else {
                alert(`Fout: ${result.error || "Onbekende fout"}`);
            }
        } catch (error) {
            console.error("Error creating opportunity:", error);
            alert("Fout bij het toevoegen van kans");
        }
    }

    async updateOpportunity(originalName) {
        const formData = new FormData(
            document.getElementById("opportunityForm"),
        );
        const opportunityData = {};

        for (let [key, value] of formData.entries()) {
            if (value.trim()) {
                if (key === "Latitude" || key === "Longitude") {
                    opportunityData[key] = parseFloat(value);
                } else {
                    opportunityData[key] = value;
                }
            }
        }

        try {
            const response = await fetch(
                `/admin/api/opportunities/${encodeURIComponent(originalName)}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${this.token}`,
                    },
                    body: JSON.stringify(opportunityData),
                },
            );

            const result = await response.json();

            if (response.ok) {
                closeModal("opportunityModal");
                this.loadOpportunities();
                alert("Kans succesvol bijgewerkt!");
            } else {
                alert(`Fout: ${result.error || "Onbekende fout"}`);
            }
        } catch (error) {
            console.error("Error updating opportunity:", error);
            alert("Fout bij het bijwerken van kans");
        }
    }

    async deleteOpportunity(opportunityName) {
        if (
            !confirm(
                `Weet je zeker dat je "${opportunityName}" wilt verwijderen?`,
            )
        ) {
            return;
        }

        try {
            const response = await fetch(
                `/admin/api/opportunities/${encodeURIComponent(opportunityName)}`,
                {
                    method: "DELETE",
                    headers: {
                        Authorization: `Bearer ${this.token}`,
                    },
                },
            );

            const result = await response.json();

            if (response.ok) {
                this.loadOpportunities();
                alert("Kans succesvol verwijderd!");
            } else {
                alert(`Fout: ${result.error || "Onbekende fout"}`);
            }
        } catch (error) {
            console.error("Error deleting opportunity:", error);
            alert("Fout bij het verwijderen van kans");
        }
    }

    async openFilterSelectionModal(opportunityName) {
        try {
            // Load current filters
            const filtersResponse = await fetch("/admin/api/filters", {
                headers: {
                    Authorization: `Bearer ${this.token}`,
                },
            });

            if (!filtersResponse.ok) {
                throw new Error("Failed to load filters");
            }

            const filters = await filtersResponse.json();

            // Find the opportunity
            const opportunity = this.allOpportunities.find(
                (o) => o.Name === opportunityName,
            );
            if (!opportunity) {
                alert("Kans niet gevonden");
                return;
            }

            // Create modal with filter checkboxes
            const modalHTML = `
                <div id="filterSelectionModal" class="modal-overlay">
                    <div class="modal-content" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
                        <div class="modal-header">
                            <h3>Filters instellen voor: ${opportunityName}</h3>
                            <button class="modal-close" onclick="closeModal('filterSelectionModal')">×</button>
                        </div>
                        <div class="modal-body">
                            <p style="margin-bottom: 1rem; color: #666;">Selecteer de filters waar deze kans onder gevonden moet worden:</p>

                            <div class="filter-categories">
                                ${this.renderFilterCategory("HBMSector", "Sectoren", filters.HBMSector, opportunity.HBMSector)}
                                ${this.renderFilterCategory("OrganizationType", "Organisatie Types", filters.OrganizationType, opportunity.OrganizationType)}
                                ${this.renderFilterCategory("OrganizationField", "Vakgebieden", filters.OrganizationField, opportunity.OrganizationField)}
                                ${this.renderFilterCategory("ProjectType", "Project Types", filters.ProjectType, opportunity.ProjectType)}
                                ${this.renderFilterCategory("HBMTopic", "HBM Topics", filters.HBMTopic, opportunity.HBMTopic)}
                                ${this.renderFilterCategory("HBMCharacteristics", "HBM Karakteristieken", filters.HBMCharacteristics, opportunity.HBMCharacteristics)}
                            </div>
                        </div>
                        <div class="modal-actions">
                            <button type="button" class="btn btn-secondary" onclick="closeModal('filterSelectionModal')">Annuleren</button>
                            <button type="button" class="btn btn-primary" onclick="adminApp.saveOpportunityFilters('${opportunityName}')">Opslaan</button>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML("beforeend", modalHTML);
        } catch (error) {
            console.error("Error opening filter selection modal:", error);
            alert("Fout bij het laden van filters");
        }
    }

    renderFilterCategory(
        categoryKey,
        categoryName,
        filterOptions,
        currentValues,
    ) {
        const currentArray = Array.isArray(currentValues)
            ? currentValues
            : currentValues
              ? [currentValues]
              : [];

        return `
            <div class="filter-category" style="margin-bottom: 1.5rem; border: 1px solid #ddd; border-radius: 8px; padding: 1rem;">
                <h4 style="margin: 0 0 0.75rem 0; color: rgb(38, 123, 41);">${categoryName}</h4>
                <div class="filter-options" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.5rem;">
                    ${filterOptions
                        .map(
                            (option) => `
                        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; padding: 0.25rem;">
                            <input type="checkbox" 
                                   name="${categoryKey}" 
                                   value="${option}" 
                                   ${currentArray.includes(option) ? "checked" : ""}
                                   style="margin: 0;">
                            <span style="font-size: 0.9rem;">${option}</span>
                        </label>
                    `,
                        )
                        .join("")}
                </div>
            </div>
        `;
    }

    async saveOpportunityFilters(opportunityName) {
        try {
            const modal = document.getElementById("filterSelectionModal");
            const formData = new FormData();

            // Collect all checked values for each category
            const categories = [
                "HBMSector",
                "OrganizationType",
                "OrganizationField",
                "ProjectType",
                "HBMTopic",
                "HBMCharacteristics",
            ];
            const updatedOpportunity = {};

            categories.forEach((category) => {
                const checkboxes = modal.querySelectorAll(
                    `input[name="${category}"]:checked`,
                );
                const values = Array.from(checkboxes).map((cb) => cb.value);

                if (values.length > 0) {
                    updatedOpportunity[category] =
                        values.length === 1 ? values[0] : values;
                }
            });

            // Find the original opportunity to preserve other data
            const originalOpportunity = this.allOpportunities.find(
                (o) => o.Name === opportunityName,
            );
            if (!originalOpportunity) {
                alert("Kans niet gevonden");
                return;
            }

            // Merge with existing data
            const completeOpportunityData = {
                ...originalOpportunity,
                ...updatedOpportunity,
            };

            // Save via API
            const response = await fetch(
                `/admin/api/opportunities/${encodeURIComponent(opportunityName)}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${this.token}`,
                    },
                    body: JSON.stringify(completeOpportunityData),
                },
            );

            const result = await response.json();

            if (response.ok) {
                closeModal("filterSelectionModal");
                this.loadOpportunities();
                alert("Filters succesvol opgeslagen!");
            } else {
                alert(`Fout: ${result.error || "Onbekende fout"}`);
            }
        } catch (error) {
            console.error("Error saving opportunity filters:", error);
            alert("Fout bij het opslaan van filters");
        }
    }

    openLocationPicker() {
        // Get current values if they exist
        const currentLat =
            document.getElementById("opportunityLat").value || 51.2;
        const currentLng =
            document.getElementById("opportunityLng").value || 6.0;

        const modalHTML = `
            <div id="locationPickerModal" class="modal-overlay">
                <div class="modal-content" style="max-width: 800px; max-height: 90vh;">
                    <div class="modal-header">
                        <h3>Selecteer locatie op kaart</h3>
                        <button class="modal-close" onclick="closeModal('locationPickerModal')">×</button>
                    </div>
                    <div class="modal-body">
                        <div id="locationPickerMap" style="height: 400px; border: 1px solid #ddd; border-radius: 4px;"></div>
                        <div style="margin-top: 1rem; padding: 1rem; background: #f8f9fa; border-radius: 4px;">
                            <p style="margin: 0 0 0.5rem 0;"><strong>Instructies:</strong></p>
                            <p style="margin: 0; font-size: 0.9em;">Zoom en sleep de kaart om de gewenste locatie in het midden te plaatsen. De rode marker toont de huidige selectie.</p>
                            <div style="margin-top: 0.5rem;">
                                <strong>Huidige coördinaten:</strong> 
                                <span id="currentCoordinates">${currentLat}, ${currentLng}</span>
                            </div>
                        </div>
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn btn-secondary" onclick="closeModal('locationPickerModal')">Annuleren</button>
                        <button type="button" class="btn btn-primary" onclick="adminApp.saveSelectedLocation()">Locatie opslaan</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML("beforeend", modalHTML);

        // Initialize map after modal is added to DOM
        setTimeout(() => {
            this.initLocationPickerMap(
                parseFloat(currentLat),
                parseFloat(currentLng),
            );
        }, 100);
    }

    initLocationPickerMap(lat, lng) {
        if (typeof L === "undefined") {
            // Load Leaflet if not available
            const leafletCSS = document.createElement("link");
            leafletCSS.rel = "stylesheet";
            leafletCSS.href =
                "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
            document.head.appendChild(leafletCSS);

            const leafletJS = document.createElement("script");
            leafletJS.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
            document.head.appendChild(leafletJS);

            leafletJS.onload = () => {
                this.createLocationPickerMap(lat, lng);
            };
        } else {
            this.createLocationPickerMap(lat, lng);
        }
    }

    createLocationPickerMap(lat, lng) {
        const mapContainer = document.getElementById("locationPickerMap");
        if (!mapContainer) return;

        // Initialize map
        this.locationPickerMap = L.map("locationPickerMap", {
            center: [lat, lng],
            zoom: 16,
            zoomControl: true,
        });

        // Add base tile layer
        L.tileLayer(
            "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
            {
                attribution: "© OpenStreetMap contributors © CARTO",
                maxZoom: 18,
            },
        ).addTo(this.locationPickerMap);

        // Add center marker
        this.centerMarker = L.marker([lat, lng], {
            draggable: false,
            icon: L.icon({
                iconUrl:
                    "data:image/svg+xml;base64," +
                    btoa(`
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="8" fill="#dc3545" stroke="#fff" stroke-width="2"/>
                    </svg>
                `),
                iconSize: [24, 24],
                iconAnchor: [12, 12],
            }),
        }).addTo(this.locationPickerMap);

        // Update coordinates on map move
        this.locationPickerMap.on("move", () => {
            const center = this.locationPickerMap.getCenter();
            this.centerMarker.setLatLng(center);

            const coordinatesElement =
                document.getElementById("currentCoordinates");
            if (coordinatesElement) {
                coordinatesElement.textContent = `${center.lat.toFixed(6)}, ${center.lng.toFixed(6)}`;
            }
        });

        // Set initial coordinates display
        const coordinatesElement =
            document.getElementById("currentCoordinates");
        if (coordinatesElement) {
            coordinatesElement.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        }
    }

    saveSelectedLocation() {
        if (this.locationPickerMap) {
            const center = this.locationPickerMap.getCenter();

            // Update the form fields
            document.getElementById("opportunityLat").value =
                center.lat.toFixed(6);
            document.getElementById("opportunityLng").value =
                center.lng.toFixed(6);

            // Clean up map
            this.locationPickerMap.remove();
            this.locationPickerMap = null;
            this.centerMarker = null;

            // Close modal
            closeModal("locationPickerModal");
        }
    }

    openLogoUploadModal() {
        const modalHTML = `
            <div id="logoUploadModal" class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Logo toevoegen</h3>
                        <button class="modal-close" onclick="closeModal('logoUploadModal')">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label>Kies hoe je het logo wilt toevoegen:</label>
                            <div class="upload-option">
                                <label>
                                    <input type="radio" name="logoMethod" value="url" checked>
                                    URL invoeren
                                </label>
                                <label>
                                    <input type="radio" name="logoMethod" value="upload">
                                    Bestand uploaden
                                </label>
                            </div>
                        </div>

                        <div id="urlSection" class="logo-input">
                            <div class="form-group">
                                <label for="logoUrlInput">Logo URL</label>
                                <input type="url" id="logoUrlInput" placeholder="https://example.com/logo.png" style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
                                <small style="color: #666; font-size: 0.8rem;">Voer een directe link naar de afbeelding in</small>
                            </div>
                            <div id="urlPreview" style="margin-top: 1rem; display: none;">
                                <img id="urlPreviewImage" style="max-width: 200px; max-height: 100px; border: 1px solid #ddd; border-radius: 4px;" />
                            </div>
                        </div>

                        <div id="uploadSection" class="logo-input" style="display: none;">
                            <div class="form-group">
                                <label for="logoUploadFile">Selecteer logo bestand</label>
                                <input type="file" id="logoUploadFile" accept="image/*" style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
                                <small style="color: #666; font-size: 0.8rem;">Ondersteunde formaten: JPG, PNG, SVG, GIF (max 5MB)</small>
                            </div>
                            <div id="logoUploadPreview" style="margin-top: 1rem; display: none;">
                                <img id="logoUploadPreviewImage" style="max-width: 200px; max-height: 100px; border: 1px solid #ddd; border-radius: 4px;" />
                            </div>
                            <div id="logoUploadProgress" style="display: none; margin-top: 1rem;">
                                <div class="progress-bar">
                                    <div id="logoUploadProgressBar" class="progress-fill"></div>
                                </div>
                                <div id="logoUploadStatus"></div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn btn-secondary" onclick="closeModal('logoUploadModal')">Annuleren</button>
                        <button type="button" class="btn btn-primary" onclick="adminApp.processLogo()">Toevoegen</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML("beforeend", modalHTML);

        // Add radio button listeners
        document
            .querySelectorAll('input[name="logoMethod"]')
            .forEach((radio) => {
                radio.addEventListener("change", (e) => {
                    this.toggleLogoInputMethod(e.target.value);
                });
            });

        // Add URL input listener for preview
        document
            .getElementById("logoUrlInput")
            .addEventListener("input", (e) => {
                this.previewUrlImage(e.target.value);
            });

        // Add file change listener for preview
        document
            .getElementById("logoUploadFile")
            .addEventListener("change", (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.previewUploadedFile(file);
                }
            });
    }

    toggleLogoInputMethod(method) {
        const urlSection = document.getElementById("urlSection");
        const uploadSection = document.getElementById("uploadSection");

        if (method === "url") {
            urlSection.style.display = "block";
            uploadSection.style.display = "none";
        } else {
            urlSection.style.display = "none";
            uploadSection.style.display = "block";
        }
    }

    previewUrlImage(url) {
        const preview = document.getElementById("urlPreview");
        const previewImage = document.getElementById("urlPreviewImage");

        if (url && this.isValidImageUrl(url)) {
            previewImage.src = url;
            previewImage.onload = () => {
                preview.style.display = "block";
            };
            previewImage.onerror = () => {
                preview.style.display = "none";
            };
        } else {
            preview.style.display = "none";
        }
    }

    previewUploadedFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById("logoUploadPreview");
            const previewImage = document.getElementById(
                "logoUploadPreviewImage",
            );
            previewImage.src = e.target.result;
            preview.style.display = "block";
        };
        reader.readAsDataURL(file);
    }

    isValidImageUrl(url) {
        try {
            new URL(url);
            return /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(url);
        } catch {
            return false;
        }
    }

    async processLogo() {
        const selectedMethod = document.querySelector(
            'input[name="logoMethod"]:checked',
        ).value;

        if (selectedMethod === "url") {
            const url = document.getElementById("logoUrlInput").value.trim();
            if (!url) {
                alert("Voer een URL in");
                return;
            }
            if (!this.isValidImageUrl(url)) {
                alert("Voer een geldige afbeeldings-URL in");
                return;
            }
            this.setLogoUrl(url);
        } else {
            const fileInput = document.getElementById("logoUploadFile");
            const file = fileInput.files[0];

            if (!file) {
                alert("Selecteer eerst een bestand");
                return;
            }

            await this.uploadLogo();
        }
    }

    setLogoUrl(url) {
        // Set the URL in the main form
        const logoInput = document.getElementById("opportunityLogo");
        if (logoInput) {
            logoInput.value = url;

            // Show preview in main form
            const mainPreview = document.getElementById("logoPreview");
            const mainPreviewImage =
                document.getElementById("logoPreviewImage");
            if (mainPreview && mainPreviewImage) {
                mainPreviewImage.src = url;
                mainPreview.style.display = "block";
            }
        }

        closeModal("logoUploadModal");
        alert("Logo URL succesvol toegevoegd!");
    }

    async uploadLogo() {
        const fileInput = document.getElementById("logoUploadFile");
        const file = fileInput.files[0];

        if (!file) {
            alert("Selecteer eerst een bestand");
            return;
        }

        // Validate file
        if (file.size > 5 * 1024 * 1024) {
            alert("Bestand is te groot. Maximum grootte is 5MB.");
            return;
        }

        if (!file.type.startsWith("image/")) {
            alert("Alleen afbeeldingen zijn toegestaan.");
            return;
        }

        const progressContainer = document.getElementById("logoUploadProgress");
        const progressBar = document.getElementById("logoUploadProgressBar");
        const statusDiv = document.getElementById("logoUploadStatus");

        progressContainer.style.display = "block";
        this.updateLogoUploadProgress(10, "Bestand wordt voorbereid...");

        try {
            // Create form data
            const formData = new FormData();
            formData.append("logo", file);

            this.updateLogoUploadProgress(30, "Uploaden...");

            // Upload to server
            const response = await fetch("/admin/api/upload-logo", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${this.token}`,
                },
                body: formData,
            });

            if (!response.ok) {
                throw new Error("Upload failed");
            }

            const result = await response.json();
            this.updateLogoUploadProgress(100, "Upload voltooid!");

            // Update the logo URL field
            document.getElementById("opportunityLogo").value = result.url;

            // Show preview in main form
            const mainPreview = document.getElementById("logoPreview");
            const mainPreviewImage =
                document.getElementById("logoPreviewImage");
            if (mainPreview && mainPreviewImage) {
                mainPreviewImage.src = result.url;
                mainPreview.style.display = "block";
            }

            // Show success message and close modal
            alert("Logo succesvol geüpload!");
            setTimeout(() => {
                closeModal("logoUploadModal");
            }, 500);
        } catch (error) {
            console.error("Logo upload error:", error);
            this.updateLogoUploadProgress(0, "Upload gefaald");
            alert("Fout bij uploaden van logo");
        }
    }

    updateLogoUploadProgress(percentage, status) {
        const progressBar = document.getElementById("logoUploadProgressBar");
        const statusDiv = document.getElementById("logoUploadStatus");

        if (progressBar) progressBar.style.width = percentage + "%";
        if (statusDiv) statusDiv.textContent = status;
    }

    // Municipality tab switching functionality
    switchMunicipalityTab(tabName) {
        console.log(`[TABS] Switching to tab: ${tabName}`);

        // Remove active class from all tab buttons
        document
            .querySelectorAll(".municipality-tabs .tab-btn")
            .forEach((btn) => {
                btn.classList.remove("active");
            });

        // Hide all tab contents
        document.querySelectorAll(".tab-content").forEach((tab) => {
            tab.classList.remove("active");
        });

        // Add active class to clicked button (find by onclick attribute)
        const clickedButton = document.querySelector(
            `[onclick="window.adminApp.switchMunicipalityTab('${tabName}')"]`,
        );
        if (clickedButton) {
            clickedButton.classList.add("active");
        }

        // Show selected tab content
        const targetTab = document.getElementById(
            `municipality-${tabName}-tab`,
        );
        if (targetTab) {
            targetTab.classList.add("active");
            console.log(`[TABS] Activated tab: municipality-${tabName}-tab`);
        } else {
            console.error(`[TABS] Tab not found: municipality-${tabName}-tab`);
        }

        // Load tab-specific content
        if (tabName === "visibility") {
            this.initializeMunicipalityVisibilityMap();
        } else if (tabName === "data") {
            this.loadMunicipalities();
            if (this.municipalityLayers) {
                this.refreshMunicipalityDataTab();
            }
        }
    }

    // Refresh municipality data tab with current selections
    refreshMunicipalityDataTab() {
        if (!this.municipalityLayers) return;

        // Get currently visible municipalities
        const visibleMunicipalities = Object.keys(
            this.municipalityLayers,
        ).filter((name) => this.municipalityLayers[name].visible);

        console.log(
            `[REFRESH] Refreshing data tab with ${visibleMunicipalities.length} visible municipalities`,
        );

        // Reload municipalities with filtering
        this.loadMunicipalities();
    }

    // Initialize municipality visibility map
    async initializeMunicipalityVisibilityMap() {
        const mapContainer = document.getElementById("municipalityMap");
        if (!mapContainer) return;

        // Destroy existing map if it exists
        if (this.visibilityMap) {
            this.visibilityMap.remove();
            this.visibilityMap = null;
            this.municipalityLayers = null;
        }

        // Clear any existing content
        mapContainer.innerHTML = "";

        // Initialize Leaflet map
        if (typeof L === "undefined") {
            // Load Leaflet if not available
            const leafletCSS = document.createElement("link");
            leafletCSS.rel = "stylesheet";
            leafletCSS.href =
                "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
            document.head.appendChild(leafletCSS);

            const leafletJS = document.createElement("script");
            leafletJS.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
            document.head.appendChild(leafletJS);

            leafletJS.onload = () => {
                this.createVisibilityMap();
            };
        } else {
            this.createVisibilityMap();
        }
    }

    async createVisibilityMap() {
        const mapContainer = document.getElementById("municipalityMap");
        if (!mapContainer) return;

        try {
            // Initialize map
            this.visibilityMap = L.map("municipalityMap", {
                center: [51.2, 6.0],
                zoom: 8,
                zoomControl: true,
            });

            // Add base tile layer
            L.tileLayer(
                "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
                {
                    attribution: "© OpenStreetMap contributors © CARTO",
                    maxZoom: 18,
                },
            ).addTo(this.visibilityMap);

            // Load existing selected municipalities from database
            let selectedMunicipalities = [];
            try {
                const municipalitiesResponse = await fetch(
                    "/admin/api/municipalities",
                    {
                        headers: {
                            Authorization: `Bearer ${this.token}`,
                        },
                    },
                );
                if (municipalitiesResponse.ok) {
                    const municipalitiesData =
                        await municipalitiesResponse.json();
                    selectedMunicipalities =
                        municipalitiesData.municipalities || [];
                }
            } catch (error) {
                console.log("No existing municipalities found, starting fresh");
            }

            // Load and display Dutch municipalities
            await this.loadVisibilityMunicipalities(
                "dutch",
                selectedMunicipalities,
            );

            // Load and display German municipalities
            await this.loadVisibilityMunicipalities(
                "german",
                selectedMunicipalities,
            );

            console.log("Municipality visibility map initialized");
        } catch (error) {
            console.error("Error initializing visibility map:", error);
            mapContainer.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px;">
                    <p style="color: #dc3545; font-size: 16px;">Fout bij laden van kaart: ${error.message}</p>
                </div>
            `;
        }
    }

    async loadVisibilityMunicipalities(country, selectedMunicipalities) {
        try {
            const geoJsonPath =
                country === "dutch"
                    ? "/data/geojson/nl-gemeenten.geojson"
                    : "/data/geojson/de-gemeenten.geojson";

            const response = await fetch(geoJsonPath);
            const geoJsonData = await response.json();

            // Load current visibility data
            let visibilityData = {};
            try {
                const visibilityResponse = await fetch(
                    "/data/municipality-visibility.json",
                );
                if (visibilityResponse.ok) {
                    visibilityData = await visibilityResponse.json();
                }
            } catch (error) {
                console.log("No visibility data found, using defaults");
            }

            geoJsonData.features.forEach((feature) => {
                const municipalityName =
                    country === "dutch"
                        ? feature.properties.name
                        : feature.properties.NAME_4;

                if (!municipalityName) return;

                // Check if municipality is visible in visibility data (only true values are stored)
                const isVisible = visibilityData[municipalityName] === true;

                const layer = L.geoJSON(feature, {
                    style: {
                        color: isVisible ? "#28a745" : "#dc3545",
                        weight: country === "dutch" ? 2 : 1,
                        opacity: 0.8,
                        fillColor: isVisible ? "#28a745" : "#dc3545",
                        fillOpacity: 0.3,
                    },
                    onEachFeature: (feature, layer) => {
                        // Add click handler to toggle visibility
                        layer.on("click", () => {
                            this.toggleMunicipalityVisibility(
                                municipalityName,
                                layer,
                            );
                        });

                        // Bind tooltip with municipality name
                        layer.bindTooltip(municipalityName, {
                            permanent: false,
                            direction: "top",
                            offset: [0, -10],
                        });

                        // Add hover effects
                        layer.on("mouseover", () => {
                            layer.setStyle({
                                weight: country === "dutch" ? 4 : 2,
                                opacity: 1,
                                fillOpacity: 0.5,
                            });
                            layer.openTooltip();
                        });

                        layer.on("mouseout", () => {
                            layer.setStyle({
                                weight: country === "dutch" ? 2 : 1,
                                opacity: 0.8,
                                fillOpacity: 0.3,
                            });
                            layer.closeTooltip();
                        });
                    },
                }).addTo(this.visibilityMap);

                // Store reference for toggle functionality
                if (!this.municipalityLayers) {
                    this.municipalityLayers = {};
                }
                this.municipalityLayers[municipalityName] = {
                    layer: layer,
                    visible: isVisible,
                };
            });
        } catch (error) {
            console.error(
                `Error loading ${country} municipalities for visibility:`,
                error,
            );
        }
    }

    toggleMunicipalityVisibility(municipalityName, layer) {
        if (!this.municipalityLayers[municipalityName]) return;

        const currentVisibility =
            this.municipalityLayers[municipalityName].visible;
        const newVisibility = !currentVisibility;

        // Update layer style
        const color = newVisibility ? "#28a745" : "#dc3545";
        layer.setStyle({
            color: color,
            fillColor: color,
            weight: 2,
            opacity: 0.8,
            fillOpacity: 0.3,
        });

        // Update local state
        this.municipalityLayers[municipalityName].visible = newVisibility;

        // Update tooltip content
        layer.setTooltipContent(municipalityName);

        console.log(
            `Municipality ${municipalityName} visibility changed to: ${newVisibility}`,
        );

        // If we're currently viewing the data tab, refresh it to show updated selection
        const dataTab = document.getElementById("municipality-data-tab");
        if (dataTab && dataTab.classList.contains("active")) {
            this.refreshMunicipalityDataTab();
        }
    }

    addNewOpportunity() {
        this.openOpportunityModal();
    }
}

// Global functions
function showSection(sectionName) {
    window.adminDashboard.showSection(sectionName);
}

function logout() {
    localStorage.removeItem("admin_token");
    window.location.href = "/admin/index.html";
}

function refreshData() {
    window.adminDashboard.refreshData();
}

function exportData() {
    window.adminDashboard.exportData();
}

function importData() {
    window.adminDashboard.importData();
}

// Make adminApp globally available
window.adminApp = null;

// User Management Functions
function openAddUserModal() {
    if (window.adminDashboard.userRole !== "admin") {
        alert("Alleen administrators kunnen nieuwe gebruikers toevoegen.");
        return;
    }
    window.adminDashboard.openUserModal();
}

function editUser(userId) {
    if (
        window.adminDashboard.userRole !== "admin" &&
        userId !== window.adminDashboard.userInfo.id
    ) {
        alert("Je kunt alleen je eigen profiel bewerken.");
        return;
    }
    window.adminDashboard.openUserModal(userId);
}

async function deleteUser(userId) {
    if (window.adminDashboard.userRole !== "admin") {
        alert("Alleen administrators kunnen gebruikers verwijderen.");
        return;
    }

    if (userId === window.adminDashboard.userInfo.id) {
        alert("Je kunt jezelf niet verwijderen.");
        return;
    }

    if (confirm("Weet je zeker dat je deze gebruiker wilt verwijderen?")) {
        await window.adminDashboard.deleteUser(userId);
    }
}

// Modal functions
function openAddOpportunityModal() {
    window.adminDashboard.openOpportunityModal();
}

function openFilterSelectionModal(opportunityName) {
    window.adminDashboard.openFilterSelectionModal(opportunityName);
}

function openAddFilterModal() {
    alert('Gebruik de "Nieuw item toevoegen" knop in elke filter categorie');
}

function openAddMunicipalityModal() {
    window.adminDashboard.openMunicipalityModal();
}

function editMunicipality(name) {
    window.adminDashboard.openMunicipalityModal(name);
}

function deleteMunicipality(name) {
    if (confirm(`Weet je zeker dat je "${name}" wilt verwijderen?`)) {
        window.adminDashboard.deleteMunicipality(name);
    }
}

function editFilterItem(containerId, item) {
    window.adminDashboard.openEditFilterItemModal(containerId, item);
}

function deleteFilterItem(containerId, item) {
    if (confirm(`Weet je zeker dat je "${item}" wilt verwijderen?`)) {
        window.adminDashboard.deleteFilterItem(containerId, item);
    }
}

function closeModal(modalId = null) {
    const modals = modalId
        ? [document.getElementById(modalId)]
        : [
              document.getElementById("userModal"),
              document.getElementById("municipalityModal"),
              document.getElementById("filterModal"),
          ];

    modals.forEach((modal) => {
        if (modal) {
            modal.remove();
        }
    });
}

// Initialize dashboard when page loads
document.addEventListener("DOMContentLoaded", function () {
    window.adminDashboard = new AdminDashboard();
    window.adminApp = window.adminDashboard; // Make available globally for onclick handlers
});

// Global functions for municipality visibility

async function saveMunicipalityVisibility() {
    if (!window.adminDashboard.municipalityLayers) {
        alert("Geen gemeente data beschikbaar om op te slaan");
        return;
    }

    try {
        const visibilityData = {};

        Object.keys(window.adminDashboard.municipalityLayers).forEach(
            (municipalityName) => {
                const isVisible =
                    window.adminDashboard.municipalityLayers[municipalityName]
                        .visible;
                // Only store true values (optimization)
                if (isVisible) {
                    visibilityData[municipalityName] = true;
                }
            },
        );

        // Save visibility data
        const response = await fetch("/admin/api/municipality-visibility", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${window.adminDashboard.token}`,
            },
            body: JSON.stringify(visibilityData),
        });

        const result = await response.json();

        if (response.ok) {
            // Update municipality database with visibility changes
            const updateResponse = await fetch(
                "/admin/api/update-municipality-visibility",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${window.adminDashboard.token}`,
                    },
                    body: JSON.stringify(visibilityData),
                },
            );

            if (updateResponse.ok) {
                alert("Gemeente zichtbaarheid succesvol opgeslagen!");

                // Reload the municipalities data table to reflect changes
                window.adminDashboard.loadMunicipalities();

                // Generate new visible municipalities GeoJSON for main application
                const generateResponse = await fetch(
                    "/admin/api/generate-visible-geojson",
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${window.adminDashboard.token}`,
                        },
                    },
                );

                if (generateResponse.ok) {
                    const generateResult = await generateResponse.json();
                    console.log(
                        `Generated visible municipalities GeoJSON with ${generateResult.count} municipalities`,
                    );
                }
            } else {
                alert(
                    "Gemeente zichtbaarheid opgeslagen, maar database update gefaald",
                );
            }
        } else {
            alert(`Fout bij opslaan: ${result.message || result.error}`);
        }
    } catch (error) {
        console.error("Error saving municipality visibility:", error);
        alert("Fout bij opslaan van gemeente zichtbaarheid");
    }
}

async function saveMunicipalitiesForKansenkaart() {
    if (!window.adminDashboard.municipalityLayers) {
        alert("Geen gemeente data beschikbaar om op te slaan");
        return;
    }

    if (
        !confirm(
            "Weet je zeker dat je alle zichtbare gemeenten wilt opslaan naar municipalities.json? Er wordt automatisch een backup gemaakt van de huidige versie.",
        )
    ) {
        return;
    }

    try {
        const response = await fetch(
            "/admin/api/save-municipalities-for-kansenkaart",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${window.adminDashboard.token}`,
                },
            },
        );

        const result = await response.json();

        if (response.ok) {
            alert(
                `Succesvol ${result.count} zichtbare gemeenten opgeslagen naar municipalities.json!`,
            );

            // Reload the municipalities data table to reflect changes
            window.adminDashboard.loadMunicipalities();
        } else {
            alert(`Fout bij opslaan: ${result.message}`);
        }
    } catch (error) {
        console.error("Error saving municipalities for kansenkaart:", error);
        alert("Fout bij opslaan van gemeenten voor kansenkaart");
    }
}