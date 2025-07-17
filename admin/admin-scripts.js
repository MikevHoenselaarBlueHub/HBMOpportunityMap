
// Admin Dashboard JavaScript
class AdminDashboard {
    constructor() {
        this.currentSection = 'dashboard';
        this.token = localStorage.getItem('admin_token');
        this.userRole = null;
        this.userInfo = null;
        this.init();
    }

    init() {
        // Check if user is logged in
        if (!this.token) {
            window.location.href = '/admin/index.html';
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
            const payload = JSON.parse(atob(this.token.split('.')[1]));
            this.userRole = payload.role;
            this.userInfo = {
                username: payload.username,
                role: payload.role,
                id: payload.id
            };
            console.log('[AUTH] User info:', this.userInfo);
        } catch (error) {
            console.error('[AUTH] Error decoding token:', error);
            localStorage.removeItem('admin_token');
            window.location.href = '/admin/index.html';
        }
    }

    setupRoleBasedUI() {
        // Update user display
        const currentUserElement = document.getElementById('currentUser');
        if (currentUserElement && this.userInfo) {
            const roleDisplayName = this.userRole === 'admin' ? 'Administrator' : 'Editor';
            currentUserElement.innerHTML = `
                <div style="text-align: left;">
                    <div style="font-weight: bold;">${this.userInfo.username}</div>
                    <div style="font-size: 0.8em; color: #666;">${roleDisplayName}</div>
                </div>
            `;
        }

        // Hide/show navigation items based on role
        if (this.userRole === 'editor') {
            // Verberg admin-only secties voor editors
            const adminOnlyItems = [
                'users',
                'settings'
            ];
            
            adminOnlyItems.forEach(sectionName => {
                const navLink = document.querySelector(`[href="#${sectionName}"]`);
                if (navLink) {
                    navLink.style.display = 'none';
                }
                
                const section = document.getElementById(`${sectionName}-section`);
                if (section) {
                    section.style.display = 'none';
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
            const statsGrid = document.querySelector('.stats-grid');
            if (statsGrid && this.userRole === 'editor') {
                // Voeg editor-specifieke melding toe
                const editorMessage = document.createElement('div');
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
        console.log(`[ROLE] Gebruiker ${this.userInfo.username} heeft ${this.userRole} rechten:`, permissions);
    }

    getRolePermissions() {
        const permissions = {
            admin: [
                'Alle kansen beheren',
                'Alle filters beheren', 
                'Alle gemeenten beheren',
                'Gebruikers aanmaken/bewerken/verwijderen',
                'Systeeminstellingen wijzigen',
                'Data export/import',
                'Volledige toegang tot alle functies'
            ],
            editor: [
                'Kansen beheren (toevoegen/bewerken/verwijderen)',
                'Filters beheren (toevoegen/bewerken/verwijderen)',
                'Gemeenten beheren (toevoegen/bewerken/verwijderen)',
                'Dashboard statistieken bekijken'
            ]
        };
        
        return permissions[this.userRole] || [];
    }

    hasPermission(action) {
        const rolePermissions = {
            admin: ['all'],
            editor: [
                'view_dashboard',
                'manage_opportunities', 
                'manage_filters',
                'manage_municipalities',
                'view_stats'
            ]
        };
        
        if (this.userRole === 'admin') {
            return true; // Admin heeft alle rechten
        }
        
        return rolePermissions[this.userRole]?.includes(action) || false;
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.getAttribute('href').substring(1);
                this.showSection(section);
            });
        });

        // Settings form
        document.getElementById('appSettingsForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveSettings();
        });
    }

    showSection(sectionName) {
        // Check permissions
        if (!this.canAccessSection(sectionName)) {
            alert(`Je hebt geen toegang tot deze sectie. Je huidige rol (${this.userRole}) heeft hiervoor onvoldoende rechten.`);
            return;
        }

        // Hide all sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });

        // Remove active class from all nav links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });

        // Show selected section
        document.getElementById(sectionName + '-section').classList.add('active');
        
        // Add active class to clicked nav link
        document.querySelector(`[href="#${sectionName}"]`).classList.add('active');

        // Update page title
        const titles = {
            dashboard: 'Dashboard',
            opportunities: 'Kansen beheer',
            filters: 'Filter beheer',
            municipalities: 'Gemeenten',
            users: 'Gebruikers beheer',
            settings: 'Systeeminstellingen'
        };
        document.getElementById('pageTitle').textContent = titles[sectionName] || 'Dashboard';

        // Load section-specific data
        this.loadSectionData(sectionName);
        this.currentSection = sectionName;
    }

    canAccessSection(sectionName) {
        const adminOnlySections = ['users', 'settings'];
        
        if (this.userRole === 'admin') {
            return true; // Admin heeft toegang tot alles
        }
        
        if (this.userRole === 'editor') {
            return !adminOnlySections.includes(sectionName);
        }
        
        return false;
    }

    async loadDashboardData() {
        try {
            // Load opportunities data
            const opportunitiesResponse = await fetch('/data/opportunities.json');
            const opportunities = await opportunitiesResponse.json();
            
            // Calculate stats
            const totalOpportunities = opportunities.length;
            const totalProjects = opportunities.filter(item => item.HBMType === 'Project').length;
            const totalCompanies = opportunities.filter(item => item.HBMType === 'Bedrijf').length;
            
            // Load municipalities data
            const municipalitiesResponse = await fetch('/data/municipalities.json');
            const municipalitiesData = await municipalitiesResponse.json();
            const totalMunicipalities = municipalitiesData.municipalities.length;

            // Update stats
            document.getElementById('totalOpportunities').textContent = totalOpportunities;
            document.getElementById('totalProjects').textContent = totalProjects;
            document.getElementById('totalCompanies').textContent = totalCompanies;
            document.getElementById('totalMunicipalities').textContent = totalMunicipalities;

        } catch (error) {
            console.error('Error loading dashboard data:', error);
        }
    }

    async loadSectionData(sectionName) {
        switch(sectionName) {
            case 'opportunities':
                await this.loadOpportunities();
                break;
            case 'filters':
                await this.loadFilters();
                break;
            case 'municipalities':
                await this.loadMunicipalities();
                break;
            case 'users':
                await this.loadUsers();
                break;
        }
    }

    async loadOpportunities() {
        try {
            const response = await fetch('/data/opportunities.json');
            const opportunities = await response.json();
            
            const tableBody = document.getElementById('opportunitiesTableBody');
            tableBody.innerHTML = '';
            
            opportunities.forEach(opportunity => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${opportunity.Name || 'N/A'}</td>
                    <td>${opportunity.HBMType || 'N/A'}</td>
                    <td>${opportunity.Municipality || 'N/A'}</td>
                    <td>${opportunity.HBMSector || 'N/A'}</td>
                    <td class="action-buttons">
                        <button class="action-btn edit-btn" onclick="editOpportunity('${opportunity.Name}')">Bewerken</button>
                        <button class="action-btn delete-btn" onclick="deleteOpportunity('${opportunity.Name}')">Verwijderen</button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
        } catch (error) {
            console.error('Error loading opportunities:', error);
        }
    }

    async loadFilters() {
        try {
            const response = await fetch('/data/filters.json');
            const filters = await response.json();
            
            this.renderFilterCategory('projectTypesFilter', filters.ProjectType);
            this.renderFilterCategory('organizationTypesFilter', filters.OrganizationType);
            this.renderFilterCategory('hbmTopicsFilter', filters.HBMTopic);
            this.renderFilterCategory('hbmSectorsFilter', filters.HBMSector);
        } catch (error) {
            console.error('Error loading filters:', error);
        }
    }

    renderFilterCategory(containerId, items) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        
        // Add button to add new filter item
        const addButton = document.createElement('button');
        addButton.className = 'btn btn-primary';
        addButton.style.cssText = 'margin-bottom: 1rem; width: 100%;';
        addButton.textContent = 'Nieuw item toevoegen';
        addButton.onclick = () => this.openAddFilterItemModal(containerId);
        container.appendChild(addButton);
        
        items.forEach(item => {
            const div = document.createElement('div');
            div.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; padding: 0.5rem; background: white; border-radius: 4px; border: 1px solid #ddd;';
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
            const response = await fetch('/data/municipalities.json');
            const data = await response.json();
            
            const tableBody = document.getElementById('municipalitiesTableBody');
            tableBody.innerHTML = '';
            
            data.municipalities.forEach(municipality => {
                const canDelete = this.userRole === 'admin';
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${municipality.name}</td>
                    <td>${municipality.code === 'NL' ? 'Nederland' : 'Duitsland'}</td>
                    <td>${municipality.population ? municipality.population.toLocaleString() : 'N/A'}</td>
                    <td>${municipality.area || 'N/A'}</td>
                    <td class="action-buttons">
                        <button class="action-btn edit-btn" onclick="editMunicipality('${municipality.name}')">Bewerken</button>
                        ${canDelete ? 
                            `<button class="action-btn delete-btn" onclick="deleteMunicipality('${municipality.name}')">Verwijderen</button>` : 
                            `<span style="color: #999; font-size: 0.8em;">Alleen admin kan verwijderen</span>`
                        }
                    </td>
                `;
                tableBody.appendChild(row);
            });
        } catch (error) {
            console.error('Error loading municipalities:', error);
        }
    }

    async loadUsers() {
        // Check if user has permission to view users
        if (!this.hasPermission('manage_users') && this.userRole !== 'admin') {
            const tableBody = document.getElementById('usersTableBody');
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
            const response = await fetch('/admin/api/users', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load users');
            }
            
            const users = await response.json();
            
            const tableBody = document.getElementById('usersTableBody');
            tableBody.innerHTML = '';
            
            users.forEach(user => {
                const canEditUser = this.userRole === 'admin' || user.id === this.userInfo.id;
                const canDeleteUser = this.userRole === 'admin' && user.id !== this.userInfo.id;
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${user.username}</td>
                    <td>${user.email}</td>
                    <td>
                        <span class="role-badge role-${user.role}">
                            ${user.role === 'admin' ? 'Administrator' : 'Editor'}
                        </span>
                    </td>
                    <td>${new Date(user.created).toLocaleDateString('nl-NL')}</td>
                    <td class="action-buttons">
                        ${canEditUser ? `<button class="action-btn edit-btn" onclick="editUser(${user.id})">Bewerken</button>` : ''}
                        ${canDeleteUser ? `<button class="action-btn delete-btn" onclick="deleteUser(${user.id})">Verwijderen</button>` : ''}
                        ${!canEditUser && !canDeleteUser ? '<span style="color: #999;">Geen acties beschikbaar</span>' : ''}
                    </td>
                `;
                tableBody.appendChild(row);
            });
        } catch (error) {
            console.error('Error loading users:', error);
            alert('Fout bij het laden van gebruikers');
        }
    }

    openUserModal(userId = null) {
        // Check permissions
        if (this.userRole !== 'admin') {
            alert('Alleen administrators kunnen gebruikers aanmaken of bewerken.');
            return;
        }

        const isEdit = userId !== null;
        
        const modalHTML = `
            <div id="userModal" class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>${isEdit ? 'Gebruiker bewerken' : 'Nieuwe gebruiker toevoegen'}</h3>
                        <button class="modal-close" onclick="closeModal()">×</button>
                    </div>
                    <form id="userForm" class="modal-form">
                        <div class="form-group">
                            <label for="username">Gebruikersnaam *</label>
                            <input type="text" id="username" name="username" required ${isEdit ? 'readonly' : ''}>
                        </div>
                        <div class="form-group">
                            <label for="email">Email *</label>
                            <input type="email" id="email" name="email" required>
                        </div>
                        <div class="form-group">
                            <label for="password">Wachtwoord ${isEdit ? '(laat leeg om niet te wijzigen)' : '*'}</label>
                            <input type="password" id="password" name="password" ${isEdit ? '' : 'required'}>
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
                            <button type="submit" class="btn btn-primary">${isEdit ? 'Opslaan' : 'Toevoegen'}</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        const form = document.getElementById('userForm');
        form.addEventListener('submit', (e) => {
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
            const response = await fetch('/admin/api/users', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load user data');
            }
            
            const users = await response.json();
            const user = users.find(u => u.id === userId);
            
            if (user) {
                document.getElementById('username').value = user.username;
                document.getElementById('email').value = user.email;
                document.getElementById('role').value = user.role;
            }
        } catch (error) {
            console.error('Error loading user data:', error);
            alert('Fout bij het laden van gebruikersgegevens');
        }
    }

    async createUser() {
        const formData = new FormData(document.getElementById('userForm'));
        const userData = {
            username: formData.get('username'),
            email: formData.get('email'),
            password: formData.get('password'),
            role: formData.get('role')
        };
        
        try {
            const response = await fetch('/admin/api/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(userData)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                alert('Gebruiker succesvol toegevoegd!');
                closeModal();
                this.loadUsers();
            } else {
                alert(`Fout: ${result.error || 'Onbekende fout'}`);
            }
        } catch (error) {
            console.error('Error creating user:', error);
            alert('Fout bij het toevoegen van gebruiker');
        }
    }

    async updateUser(userId) {
        const formData = new FormData(document.getElementById('userForm'));
        const userData = {
            email: formData.get('email'),
            role: formData.get('role')
        };
        
        const password = formData.get('password');
        if (password) {
            userData.password = password;
        }
        
        try {
            const response = await fetch(`/admin/api/users/${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(userData)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                alert('Gebruiker succesvol bijgewerkt!');
                closeModal();
                this.loadUsers();
            } else {
                alert(`Fout: ${result.error || 'Onbekende fout'}`);
            }
        } catch (error) {
            console.error('Error updating user:', error);
            alert('Fout bij het bijwerken van gebruiker');
        }
    }

    async deleteUser(userId) {
        try {
            const response = await fetch(`/admin/api/users/${userId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            const result = await response.json();
            
            if (response.ok) {
                alert('Gebruiker succesvol verwijderd!');
                this.loadUsers();
            } else {
                alert(`Fout: ${result.error || 'Onbekende fout'}`);
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            alert('Fout bij het verwijderen van gebruiker');
        }
    }

    saveSettings() {
        const appTitle = document.getElementById('appTitle').value;
        const defaultZoom = document.getElementById('defaultZoom').value;
        
        // Save settings to localStorage for now
        localStorage.setItem('app_settings', JSON.stringify({
            appTitle,
            defaultZoom: parseInt(defaultZoom)
        }));
        
        alert('Instellingen opgeslagen!');
    }

    exportData() {
        // Export all data as JSON
        Promise.all([
            fetch('/data/opportunities.json').then(r => r.json()),
            fetch('/data/filters.json').then(r => r.json()),
            fetch('/data/municipalities.json').then(r => r.json())
        ]).then(([opportunities, filters, municipalities]) => {
            const exportData = {
                opportunities,
                filters,
                municipalities,
                exportDate: new Date().toISOString()
            };
            
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `hbm-data-export-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
        });
    }

    importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const data = JSON.parse(e.target.result);
                        console.log('Imported data:', data);
                        alert('Data geïmporteerd! (Implementatie vereist voor opslaan naar server)');
                    } catch (error) {
                        alert('Fout bij het importeren van data. Controleer het bestand.');
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
        alert('Data vernieuwd!');
    }

    // Municipality Management Functions
    openMunicipalityModal(municipalityName = null) {
        const isEdit = municipalityName !== null;
        
        const modalHTML = `
            <div id="municipalityModal" class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>${isEdit ? 'Gemeente bewerken' : 'Nieuwe gemeente toevoegen'}</h3>
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
                            <button type="submit" class="btn btn-primary">${isEdit ? 'Opslaan' : 'Toevoegen'}</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Set up country-code synchronization
        const countrySelect = document.getElementById('municipalityCountry');
        const codeSelect = document.getElementById('municipalityCode');
        
        countrySelect.addEventListener('change', () => {
            if (countrySelect.value === 'Netherlands') {
                codeSelect.value = 'NL';
            } else if (countrySelect.value === 'Germany') {
                codeSelect.value = 'DE';
            }
        });
        
        codeSelect.addEventListener('change', () => {
            if (codeSelect.value === 'NL') {
                countrySelect.value = 'Netherlands';
            } else if (codeSelect.value === 'DE') {
                countrySelect.value = 'Germany';
            }
        });
        
        const form = document.getElementById('municipalityForm');
        form.addEventListener('submit', (e) => {
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
            const response = await fetch('/data/municipalities.json');
            const data = await response.json();
            const municipality = data.municipalities.find(m => m.name === municipalityName);
            
            if (municipality) {
                document.getElementById('municipalityName').value = municipality.name;
                document.getElementById('municipalityCountry').value = municipality.country;
                document.getElementById('municipalityCode').value = municipality.code;
                document.getElementById('municipalityPopulation').value = municipality.population || '';
                document.getElementById('municipalityArea').value = municipality.area || '';
                document.getElementById('municipalityPlaces').value = municipality.largest_places ? municipality.largest_places.join(', ') : '';
            }
        } catch (error) {
            console.error('Error loading municipality data:', error);
            alert('Fout bij het laden van gemeente gegevens');
        }
    }

    async createMunicipality() {
        const formData = new FormData(document.getElementById('municipalityForm'));
        const municipalityData = {
            name: formData.get('name'),
            country: formData.get('country'),
            code: formData.get('code'),
            population: formData.get('population'),
            area: formData.get('area'),
            largest_places: formData.get('largest_places')
        };
        
        try {
            const response = await fetch('/admin/api/municipalities', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(municipalityData)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                alert('Gemeente succesvol toegevoegd!');
                closeModal('municipalityModal');
                this.loadMunicipalities();
            } else {
                alert(`Fout: ${result.message || 'Onbekende fout'}`);
            }
        } catch (error) {
            console.error('Error creating municipality:', error);
            alert('Fout bij het toevoegen van gemeente');
        }
    }

    async updateMunicipality(municipalityName) {
        const formData = new FormData(document.getElementById('municipalityForm'));
        const municipalityData = {
            name: formData.get('name'),
            country: formData.get('country'),
            code: formData.get('code'),
            population: formData.get('population'),
            area: formData.get('area'),
            largest_places: formData.get('largest_places')
        };
        
        try {
            const response = await fetch(`/admin/api/municipalities/${encodeURIComponent(municipalityName)}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(municipalityData)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                alert('Gemeente succesvol bijgewerkt!');
                closeModal('municipalityModal');
                this.loadMunicipalities();
            } else {
                alert(`Fout: ${result.message || 'Onbekende fout'}`);
            }
        } catch (error) {
            console.error('Error updating municipality:', error);
            alert('Fout bij het bijwerken van gemeente');
        }
    }

    async deleteMunicipality(municipalityName) {
        if (this.userRole !== 'admin') {
            alert('Alleen administrators kunnen gemeenten verwijderen.');
            return;
        }

        try {
            const response = await fetch(`/admin/api/municipalities/${encodeURIComponent(municipalityName)}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            const result = await response.json();
            
            if (response.ok) {
                alert('Gemeente succesvol verwijderd!');
                this.loadMunicipalities();
            } else {
                alert(`Fout: ${result.message || 'Onbekende fout'}`);
            }
        } catch (error) {
            console.error('Error deleting municipality:', error);
            alert('Fout bij het verwijderen van gemeente');
        }
    }

    // Filter Management Functions
    openAddFilterItemModal(containerId) {
        const categoryMap = {
            'projectTypesFilter': 'ProjectType',
            'organizationTypesFilter': 'OrganizationType',
            'hbmTopicsFilter': 'HBMTopic',
            'hbmSectorsFilter': 'HBMSector'
        };
        
        const category = categoryMap[containerId];
        const categoryDisplayName = {
            'ProjectType': 'Project Types',
            'OrganizationType': 'Organisatie Types',
            'HBMTopic': 'HBM Topics',
            'HBMSector': 'HBM Sectoren'
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
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        const form = document.getElementById('filterForm');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.createFilterItem(category);
        });
    }

    openEditFilterItemModal(containerId, item) {
        const categoryMap = {
            'projectTypesFilter': 'ProjectType',
            'organizationTypesFilter': 'OrganizationType',
            'hbmTopicsFilter': 'HBMTopic',
            'hbmSectorsFilter': 'HBMSector'
        };
        
        const category = categoryMap[containerId];
        const categoryDisplayName = {
            'ProjectType': 'Project Types',
            'OrganizationType': 'Organisatie Types',
            'HBMTopic': 'HBM Topics',
            'HBMSector': 'HBM Sectoren'
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
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        const form = document.getElementById('filterForm');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateFilterItem(category, item);
        });
    }

    async createFilterItem(category) {
        const formData = new FormData(document.getElementById('filterForm'));
        const itemData = {
            item: formData.get('item')
        };
        
        try {
            const response = await fetch(`/admin/api/filters/${category}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(itemData)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                alert('Filter item succesvol toegevoegd!');
                closeModal('filterModal');
                this.loadFilters();
            } else {
                alert(`Fout: ${result.message || 'Onbekende fout'}`);
            }
        } catch (error) {
            console.error('Error creating filter item:', error);
            alert('Fout bij het toevoegen van filter item');
        }
    }

    async updateFilterItem(category, oldItem) {
        const formData = new FormData(document.getElementById('filterForm'));
        const itemData = {
            item: formData.get('item')
        };
        
        try {
            const response = await fetch(`/admin/api/filters/${category}/${encodeURIComponent(oldItem)}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(itemData)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                alert('Filter item succesvol bijgewerkt!');
                closeModal('filterModal');
                this.loadFilters();
            } else {
                alert(`Fout: ${result.message || 'Onbekende fout'}`);
            }
        } catch (error) {
            console.error('Error updating filter item:', error);
            alert('Fout bij het bijwerken van filter item');
        }
    }

    async deleteFilterItem(containerId, item) {
        const categoryMap = {
            'projectTypesFilter': 'ProjectType',
            'organizationTypesFilter': 'OrganizationType',
            'hbmTopicsFilter': 'HBMTopic',
            'hbmSectorsFilter': 'HBMSector'
        };
        
        const category = categoryMap[containerId];
        
        try {
            const response = await fetch(`/admin/api/filters/${category}/${encodeURIComponent(item)}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            const result = await response.json();
            
            if (response.ok) {
                alert('Filter item succesvol verwijderd!');
                this.loadFilters();
            } else {
                alert(`Fout: ${result.message || 'Onbekende fout'}`);
            }
        } catch (error) {
            console.error('Error deleting filter item:', error);
            alert('Fout bij het verwijderen van filter item');
        }
    }
}

// Global functions
function showSection(sectionName) {
    window.adminDashboard.showSection(sectionName);
}

function logout() {
    localStorage.removeItem('admin_token');
    window.location.href = '/admin/index.html';
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

// User Management Functions
function openAddUserModal() {
    if (window.adminDashboard.userRole !== 'admin') {
        alert('Alleen administrators kunnen nieuwe gebruikers toevoegen.');
        return;
    }
    window.adminDashboard.openUserModal();
}

function editUser(userId) {
    if (window.adminDashboard.userRole !== 'admin' && userId !== window.adminDashboard.userInfo.id) {
        alert('Je kunt alleen je eigen profiel bewerken.');
        return;
    }
    window.adminDashboard.openUserModal(userId);
}

async function deleteUser(userId) {
    if (window.adminDashboard.userRole !== 'admin') {
        alert('Alleen administrators kunnen gebruikers verwijderen.');
        return;
    }
    
    if (userId === window.adminDashboard.userInfo.id) {
        alert('Je kunt jezelf niet verwijderen.');
        return;
    }
    
    if (confirm('Weet je zeker dat je deze gebruiker wilt verwijderen?')) {
        await window.adminDashboard.deleteUser(userId);
    }
}

// Modal functions
function openAddOpportunityModal() {
    alert('Toevoegen van nieuwe kansen - implementatie volgt');
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
    const modals = modalId ? [document.getElementById(modalId)] : 
                  [document.getElementById('userModal'), document.getElementById('municipalityModal'), document.getElementById('filterModal')];
    
    modals.forEach(modal => {
        if (modal) {
            modal.remove();
        }
    });
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', function() {
    window.adminDashboard = new AdminDashboard();
});
