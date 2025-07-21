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

            // Add filter management header
            const filterHeader = document.createElement("div");
            filterHeader.innerHTML = `
                <div style="margin-bottom: 20px; padding: 15px; background: #e8f5e8; border-radius: 8px;">
                    <h3 style="margin: 0 0 10px 0; color: rgb(38, 123, 41);">Filter beheer</h3>
                    <p style="margin: 0 0 15px 0; color: #666;">Beheer de filtercategorieën en hun items. Wijzigingen worden automatisch opgeslagen.</p>
                </div>
            `;
            container.appendChild(filterHeader);

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
                                    ${canEdit ? `<button class="action-btn edit-btn" onclick="adminApp.openFilterModal('${category}', '${item}')" title="Bewerken">✏️</button>` : ""}
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
                            ${this.userRole === 'admin' ? 
                                `<button class="btn btn-primary" onclick="adminApp.populateMunicipalitiesDatabase()" style="background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">
                                    Database vullen met gemeenten
                                </button>` : 
                                '<p style="color: #dc3545;">Alleen administrators kunnen de database vullen.</p>'
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
                    <div class="municipality-name">${municipality.name}</div>`;

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
                const visibilityStatus = municipality.visibility !== false ? 
                    '<span style="color: #28a745; font-weight: bold;">✓ Zichtbaar</span>' : 
                    '<span style="color: #dc3545;">✗ Verborgen</span>';

                row.innerHTML = `
                    <td>${municipalityDisplay}</td>
                    <td>${municipality.country}</td>
                    <td>${municipality.code || ""}</td>
                    <td>${municipality.population ? municipality.population.toLocaleString() : ""}</td>
                    <td>${municipality.area || ""}</td>
                    <td>${visibilityStatus}</td>
                    <td>
                        ${canEdit ? `<button class="action-btn edit-btn" onclick="adminApp.openMunicipalityModal('${municipality.name}')" title="Bewerken">✏️</button>` : ""}
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
        if (this.userRole !== 'admin') {
            alert('Alleen administrators kunnen de database vullen.');
            return;
        }

        if (!confirm('Weet je zeker dat je de database wilt vullen met gemeenten uit municipalities.json? Alle gemeenten krijgen visibility: false.')) {
            return;
        }

        try {
            const response = await fetch('/admin/api/populate-municipalities-database', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                }
            });

            const result = await response.json();

            if (response.ok) {
                alert(`Database succesvol gevuld! ${result.totalCount} gemeenten toegevoegd (allemaal zichtbaar: false).`);
                this.loadMunicipalities(); // Reload the table
            } else {
                alert(`Fout bij vullen database: ${result.message}`);
            }
        } catch (error) {
            console.error('Error populating database:', error);
            alert('Fout bij vullen van database');
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
                            "Data geïmporteerd! (Implementatie vereist voor opslaan naar server)",
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

    async loadOpportunities() {
        try {
            const response = await fetch("/admin/api/opportunities", {
                headers: {
                    Authorization: `Bearer ${this.token}`,
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to load opportunities: ${response.status}`);
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

            this.renderOpportunities(opportunities);
        } catch (error) {
            console.error("Error loading opportunities:", error);
            alert("Fout bij het laden van kansen");
        }
    }

    renderOpportunitySearch() {
        const existingContainer = document.getElementById("opportunitySearchContainer");
        if (existingContainer) {
            existingContainer.remove();
        }

        // Add search container
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
        `;
        
        sectionHeader.parentNode.insertBefore(searchDiv, sectionHeader.nextSibling);

        // Add event listeners with slight delay to ensure DOM is ready
        setTimeout(() => {
            const searchInput = document.getElementById("opportunitySearch");
            const typeFilter = document.getElementById("opportunityTypeFilter");
            
            if (searchInput) {
                searchInput.addEventListener("input", () => {
                    this.filterOpportunities();
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
        const typeFilterSelect = document.getElementById("opportunityTypeFilter");
        
        if (!searchInput || !typeFilterSelect) {
            console.error("Search elements not found");
            return;
        }

        const searchTerm = searchInput.value.toLowerCase();
        const typeFilter = typeFilterSelect.value;

        let filtered = this.allOpportunities.filter(opp => {
            const matchesSearch = !searchTerm || 
                (opp.Name && opp.Name.toLowerCase().includes(searchTerm)) ||
                (opp.Municipality && opp.Municipality.toLowerCase().includes(searchTerm)) ||
                (opp.HBMSector && opp.HBMSector.toLowerCase().includes(searchTerm)) ||
                (opp.OrganizationType && opp.OrganizationType.toLowerCase().includes(searchTerm)) ||
                (opp.Description && opp.Description.toLowerCase().includes(searchTerm));

            const matchesType = !typeFilter || opp.HBMType === typeFilter;

            return matchesSearch && matchesType;
        });

        this.filteredOpportunities = filtered;
        this.renderOpportunities(filtered);
    }

    clearOpportunityFilters() {
        document.getElementById("opportunitySearch").value = "";
        document.getElementById("opportunityTypeFilter").value = "";
        this.filteredOpportunities = this.allOpportunities;
        this.renderOpportunities(this.allOpportunities);
    }

    renderOpportunities(opportunities) {
        const tableBody = document.getElementById("opportunitiesTableBody");
        tableBody.innerHTML = "";

        if (opportunities.length === 0) {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td colspan="5" style="text-align: center; padding: 2rem; color: #666;">
                    Geen kansen gevonden
                </td>
            `;
            tableBody.appendChild(row);
            return;
        }

        opportunities.forEach((opportunity) => {
            const row = document.createElement("tr");
            
            const canEdit = this.userRole === "admin" || this.userRole === "editor";
            const canDelete = this.userRole === "admin" || this.userRole === "editor";

            row.innerHTML = `
                <td>
                    <div>
                        <strong>${opportunity.Name || "Onbekend"}</strong>
                        ${opportunity.Municipality ? `<br><small style="color: #666;">${opportunity.Municipality}</small>` : ""}
                    </div>
                </td>
                <td>
                    <span class="type-badge ${opportunity.HBMType?.toLowerCase() || "unknown"}">
                        ${opportunity.HBMType || "Onbekend"}
                    </span>
                </td>
                <td>${opportunity.Municipality || "Onbekend"}</td>
                <td>${opportunity.HBMSector || "Onbekend"}</td>
                <td class="action-buttons">
                    ${canEdit ? `<button class="action-btn edit-btn" onclick="adminApp.openOpportunityModal('${opportunity.Name}')" title="Bewerken">✏️</button>` : ""}
                    ${canEdit ? `<button class="action-btn filter-btn" onclick="adminApp.openFilterSelectionModal('${opportunity.Name}')" title="Filters instellen">🔧</button>` : ""}
                    ${canDelete ? `<button class="action-btn delete-btn" onclick="adminApp.deleteOpportunity('${opportunity.Name}')">Verwijderen</button>` : ""}
                    ${!canEdit && !canDelete ? '<span style="color: #999;">Geen acties beschikbaar</span>' : ""}
                </td>
            `;
            tableBody.appendChild(row);
        });

        // Update results count
        const resultsInfo = document.getElementById("opportunityResultsInfo");
        if (!resultsInfo) {
            const searchContainer = document.getElementById("opportunitySearchContainer");
            const infoDiv = document.createElement("div");
            infoDiv.id = "opportunityResultsInfo";
            infoDiv.style.cssText = "margin-bottom: 1rem; color: #666; font-size: 0.9rem;";
            searchContainer.appendChild(infoDiv);
        }
        
        document.getElementById("opportunityResultsInfo").textContent = 
            `${opportunities.length} van ${this.allOpportunities.length} kansen`;
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
                            <label for="opportunityLogo">Logo URL</label>
                            <input type="url" id="opportunityLogo" name="Logo">
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

        if (isEdit) {
            this.loadOpportunityData(opportunityName);
        } else {
            // Load municipality dropdown for new opportunities
            this.loadMunicipalityDropdown();
        }
    }

    async loadOpportunityData(opportunityName) {
        try {
            const opportunity = this.allOpportunities.find(o => o.Name === opportunityName);

            if (opportunity) {
                document.getElementById("opportunityName").value = opportunity.Name || "";
                document.getElementById("opportunityType").value = opportunity.HBMType || "";
                // Load municipality dropdown
                await this.loadMunicipalityDropdown();
                document.getElementById("opportunityMunicipality").value = opportunity.Municipality || "";
                document.getElementById("opportunityDescription").value = opportunity.Description || "";
                document.getElementById("opportunityLat").value = opportunity.Latitude || "";
                document.getElementById("opportunityLng").value = opportunity.Longitude || "";
                document.getElementById("opportunityLogo").value = opportunity.Logo || "";
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
                const municipalitySelect = document.getElementById("opportunityMunicipality");
                
                if (municipalitySelect) {
                    // Clear existing options except the first one
                    municipalitySelect.innerHTML = '<option value="">Selecteer gemeente</option>';
                    
                    // Add municipalities
                    data.municipalities.forEach(municipality => {
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
        const formData = new FormData(document.getElementById("newMunicipalityForm"));
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
                document.getElementById("opportunityMunicipality").value = municipalityData.name;
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
        const formData = new FormData(document.getElementById("opportunityForm"));
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
        const formData = new FormData(document.getElementById("opportunityForm"));
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
            const response = await fetch(`/admin/api/opportunities/${encodeURIComponent(originalName)}`, {
                method: "PUT",
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
        if (!confirm(`Weet je zeker dat je "${opportunityName}" wilt verwijderen?`)) {
            return;
        }

        try {
            const response = await fetch(`/admin/api/opportunities/${encodeURIComponent(opportunityName)}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${this.token}`,
                },
            });

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
            const opportunity = this.allOpportunities.find(o => o.Name === opportunityName);
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
                                ${this.renderFilterCategory('HBMSector', 'Sectoren', filters.HBMSector, opportunity.HBMSector)}
                                ${this.renderFilterCategory('OrganizationType', 'Organisatie Types', filters.OrganizationType, opportunity.OrganizationType)}
                                ${this.renderFilterCategory('OrganizationField', 'Vakgebieden', filters.OrganizationField, opportunity.OrganizationField)}
                                ${this.renderFilterCategory('ProjectType', 'Project Types', filters.ProjectType, opportunity.ProjectType)}
                                ${this.renderFilterCategory('HBMTopic', 'HBM Topics', filters.HBMTopic, opportunity.HBMTopic)}
                                ${this.renderFilterCategory('HBMCharacteristics', 'HBM Karakteristieken', filters.HBMCharacteristics, opportunity.HBMCharacteristics)}
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

    renderFilterCategory(categoryKey, categoryName, filterOptions, currentValues) {
        const currentArray = Array.isArray(currentValues) ? currentValues : 
                           (currentValues ? [currentValues] : []);
        
        return `
            <div class="filter-category" style="margin-bottom: 1.5rem; border: 1px solid #ddd; border-radius: 8px; padding: 1rem;">
                <h4 style="margin: 0 0 0.75rem 0; color: rgb(38, 123, 41);">${categoryName}</h4>
                <div class="filter-options" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.5rem;">
                    ${filterOptions.map(option => `
                        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; padding: 0.25rem;">
                            <input type="checkbox" 
                                   name="${categoryKey}" 
                                   value="${option}" 
                                   ${currentArray.includes(option) ? 'checked' : ''}
                                   style="margin: 0;">
                            <span style="font-size: 0.9rem;">${option}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
        `;
    }

    async saveOpportunityFilters(opportunityName) {
        try {
            const modal = document.getElementById('filterSelectionModal');
            const formData = new FormData();
            
            // Collect all checked values for each category
            const categories = ['HBMSector', 'OrganizationType', 'OrganizationField', 'ProjectType', 'HBMTopic', 'HBMCharacteristics'];
            const updatedOpportunity = {};
            
            categories.forEach(category => {
                const checkboxes = modal.querySelectorAll(`input[name="${category}"]:checked`);
                const values = Array.from(checkboxes).map(cb => cb.value);
                
                if (values.length > 0) {
                    updatedOpportunity[category] = values.length === 1 ? values[0] : values;
                }
            });

            // Find the original opportunity to preserve other data
            const originalOpportunity = this.allOpportunities.find(o => o.Name === opportunityName);
            if (!originalOpportunity) {
                alert("Kans niet gevonden");
                return;
            }

            // Merge with existing data
            const completeOpportunityData = {
                ...originalOpportunity,
                ...updatedOpportunity
            };

            // Save via API
            const response = await fetch(`/admin/api/opportunities/${encodeURIComponent(opportunityName)}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.token}`,
                },
                body: JSON.stringify(completeOpportunityData),
            });

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
        const currentLat = document.getElementById("opportunityLat").value || 51.2;
        const currentLng = document.getElementById("opportunityLng").value || 6.0;

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
            this.initLocationPickerMap(parseFloat(currentLat), parseFloat(currentLng));
        }, 100);
    }

    initLocationPickerMap(lat, lng) {
        if (typeof L === "undefined") {
            // Load Leaflet if not available
            const leafletCSS = document.createElement("link");
            leafletCSS.rel = "stylesheet";
            leafletCSS.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
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
                iconUrl: 'data:image/svg+xml;base64,' + btoa(`
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="8" fill="#dc3545" stroke="#fff" stroke-width="2"/>
                    </svg>
                `),
                iconSize: [24, 24],
                iconAnchor: [12, 12],
            })
        }).addTo(this.locationPickerMap);

        // Update coordinates on map move
        this.locationPickerMap.on('move', () => {
            const center = this.locationPickerMap.getCenter();
            this.centerMarker.setLatLng(center);
            
            const coordinatesElement = document.getElementById("currentCoordinates");
            if (coordinatesElement) {
                coordinatesElement.textContent = `${center.lat.toFixed(6)}, ${center.lng.toFixed(6)}`;
            }
        });

        // Set initial coordinates display
        const coordinatesElement = document.getElementById("currentCoordinates");
        if (coordinatesElement) {
            coordinatesElement.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        }
    }

    saveSelectedLocation() {
        if (this.locationPickerMap) {
            const center = this.locationPickerMap.getCenter();
            
            // Update the form fields
            document.getElementById("opportunityLat").value = center.lat.toFixed(6);
            document.getElementById("opportunityLng").value = center.lng.toFixed(6);
            
            // Clean up map
            this.locationPickerMap.remove();
            this.locationPickerMap = null;
            this.centerMarker = null;
            
            // Close modal
            closeModal("locationPickerModal");
        }
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
        const visibleMunicipalities = Object.keys(this.municipalityLayers)
            .filter((name) => this.municipalityLayers[name].visible);

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
                const visibilityResponse = await fetch("/data/municipality-visibility.json");
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
            const updateResponse = await fetch("/admin/api/update-municipality-visibility", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${window.adminDashboard.token}`,
                },
                body: JSON.stringify(visibilityData),
            });

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
                alert("Gemeente zichtbaarheid opgeslagen, maar database update gefaald");
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
