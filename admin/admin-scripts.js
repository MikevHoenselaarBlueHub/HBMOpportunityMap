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

    async loadOpportunities() {
        try {
            const response = await fetch("/data/opportunities.json");
            const opportunities = await response.json();

            const tableBody = document.getElementById("opportunitiesTableBody");
            tableBody.innerHTML = "";

            opportunities.forEach((opportunity) => {
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td>${opportunity.Name || "N/A"}</td>
                    <td>${opportunity.HBMType || "N/A"}</td>
                    <td>${opportunity.Municipality || "N/A"}</td>
                    <td>${opportunity.HBMSector || "N/A"}</td>
                    <td class="action-buttons">
                        <button class="action-btn edit-btn" onclick="editOpportunity('${opportunity.Name}')">Bewerken</button>
                        <button class="action-btn delete-btn" onclick="deleteOpportunity('${opportunity.Name}')">Verwijderen</button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
        } catch (error) {
            console.error("Error loading opportunities:", error);
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

            // Add save filters button at the top
            const saveFiltersBtn = document.createElement("div");
            saveFiltersBtn.innerHTML = `
                <div style="margin-bottom: 20px; padding: 15px; background: #e8f5e8; border-radius: 8px;">
                    <h3 style="margin: 0 0 10px 0; color: rgb(38, 123, 41);">Filter beheer</h3>
                    <p style="margin: 0 0 15px 0; color: #666;">Klik op "Filters opslaan" om de huidige filterinstellingen op te slaan naar filters.json. Er wordt automatisch een backup gemaakt.</p>
                    <button class="btn btn-primary" onclick="adminApp.saveFiltersToJson()" style="background: rgb(38, 123, 41); color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">
                        Filters opslaan naar filters.json
                    </button>
                </div>
            `;
            container.appendChild(saveFiltersBtn);

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
            // Check if we're in data tab and have visibility layers to filter by
            const isDataTab = document.getElementById("municipality-data-tab")?.classList.contains("active");
            let municipalitiesToShow = [];

            if (isDataTab && this.municipalityLayers) {
                // Show only visible municipalities from the visibility map
                const visibleMunicipalityNames = Object.keys(this.municipalityLayers)
                    .filter(name => this.municipalityLayers[name].visible);

                // Load current municipalities and filter
                const response = await fetch("/admin/api/municipalities", {
                    headers: {
                        Authorization: `Bearer ${this.token}`,
                    },
                });

                if (!response.ok) {
                    throw new Error(`Failed to load municipalities: ${response.status}`);
                }

                const data = await response.json();
                municipalitiesToShow = (data.municipalities || []).filter(
                    municipality => visibleMunicipalityNames.includes(municipality.name)
                );
            } else {
                // Load all municipalities normally
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
                municipalitiesToShow = data.municipalities || [];
            }

            const tableBody = document.querySelector(
                "#municipalitiesTable tbody",
            );
            if (!tableBody) return;

            tableBody.innerHTML = "";

            municipalitiesToShow.forEach((municipality) => {
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

                row.innerHTML = `
                    <td>${municipalityDisplay}</td>
                    <td>${municipality.country}</td>
                    <td>${municipality.code || ""}</td>
                    <td>${municipality.population ? municipality.population.toLocaleString() : ""}</td>
                    <td>${municipality.area || ""}</td>
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

    async saveFiltersToJson() {
        if (
            !confirm(
                "Weet je zeker dat je de huidige filters wilt opslaan naar filters.json? Er wordt automatisch een backup gemaakt van de huidige versie.",
            )
        ) {
            return;
        }

        try {
            // Get current filters from database
            const response = await fetch("/admin/api/filters", {
                headers: {
                    Authorization: `Bearer ${this.token}`,
                },
            });

            if (!response.ok) {
                throw new Error("Failed to load current filters");
            }

            const currentFilters = await response.json();

            // Save to filters.json with backup
            const saveResponse = await fetch(
                "/admin/api/filters/save-to-json",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${this.token}`,
                    },
                    body: JSON.stringify(currentFilters),
                },
            );

            const result = await saveResponse.json();

            if (saveResponse.ok) {
                alert(
                    "Filters succesvol opgeslagen naar filters.json! Er is automatisch een backup gemaakt.",
                );
            } else {
                alert(
                    `Fout bij opslaan: ${result.message || result.error || "Onbekende fout"}`,
                );
            }
        } catch (error) {
            console.error("Error saving filters to JSON:", error);
            alert("Fout bij opslaan van filters naar JSON bestand");
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
    alert("Toevoegen van nieuwe kansen - implementatie volgt");
}

function openAddFilterModal() {
    alert('Gebruik de "Nieuw item toevoegen" knop in elke filter categorie');
}

function openAddMunicipalityModal() {
    window.adminDashboard.openMunicipalityModal();
}

function editOpportunity(name) {
    alert(`Bewerken van kans: ${name} - implementatie volgt`);
}

function deleteOpportunity(name) {
    if (confirm(`Weet je zeker dat je "${name}" wilt verwijderen?`)) {
        alert(`Verwijderen van kans: ${name} - implementatie volgt`);
    }
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
                // Store all values explicitly (true = visible, false = hidden)
                visibilityData[municipalityName] = isVisible;
            },
        );

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
