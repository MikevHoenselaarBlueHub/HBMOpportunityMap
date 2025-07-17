
// Admin Dashboard JavaScript
class AdminDashboard {
    constructor() {
        this.currentSection = 'dashboard';
        this.token = localStorage.getItem('admin_token');
        this.init();
    }

    init() {
        // Check if user is logged in
        if (!this.token) {
            window.location.href = '/admin/index.html';
            return;
        }

        // Load initial data
        this.loadDashboardData();
        this.setupEventListeners();
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
            users: 'Gebruikers',
            settings: 'Instellingen'
        };
        document.getElementById('pageTitle').textContent = titles[sectionName] || 'Dashboard';

        // Load section-specific data
        this.loadSectionData(sectionName);
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
        
        items.forEach(item => {
            const div = document.createElement('div');
            div.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; padding: 0.5rem; background: white; border-radius: 4px;';
            div.innerHTML = `
                <span>${item}</span>
                <button class="action-btn delete-btn" onclick="deleteFilterItem('${containerId}', '${item}')">×</button>
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
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${municipality.name}</td>
                    <td>${municipality.code === 'NL' ? 'Nederland' : 'Duitsland'}</td>
                    <td>${municipality.population ? municipality.population.toLocaleString() : 'N/A'}</td>
                    <td>${municipality.area || 'N/A'}</td>
                    <td class="action-buttons">
                        <button class="action-btn edit-btn" onclick="editMunicipality('${municipality.name}')">Bewerken</button>
                        <button class="action-btn delete-btn" onclick="deleteMunicipality('${municipality.name}')">Verwijderen</button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
        } catch (error) {
            console.error('Error loading municipalities:', error);
        }
    }

    async loadUsers() {
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
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${user.username}</td>
                    <td>${user.email}</td>
                    <td>${user.role}</td>
                    <td>${new Date(user.created).toLocaleDateString('nl-NL')}</td>
                    <td class="action-buttons">
                        <button class="action-btn edit-btn" onclick="editUser(${user.id})">Bewerken</button>
                        <button class="action-btn delete-btn" onclick="deleteUser(${user.id})">Verwijderen</button>
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
                                <option value="admin">Administrator</option>
                                <option value="editor">Editor</option>
                            </select>
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
    window.adminDashboard.openUserModal();
}

function editUser(userId) {
    window.adminDashboard.openUserModal(userId);
}

async function deleteUser(userId) {
    if (confirm('Weet je zeker dat je deze gebruiker wilt verwijderen?')) {
        await window.adminDashboard.deleteUser(userId);
    }
}

// Modal functions
function openAddOpportunityModal() {
    alert('Toevoegen van nieuwe kansen - implementatie volgt');
}

function openAddFilterModal() {
    alert('Toevoegen van nieuwe filters - implementatie volgt');
}

function openAddMunicipalityModal() {
    alert('Toevoegen van nieuwe gemeenten - implementatie volgt');
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
    alert(`Bewerken van gemeente: ${name} - implementatie volgt`);
}

function deleteMunicipality(name) {
    if (confirm(`Weet je zeker dat je "${name}" wilt verwijderen?`)) {
        alert(`Verwijderen van gemeente: ${name} - implementatie volgt`);
    }
}

function deleteFilterItem(containerId, item) {
    if (confirm(`Weet je zeker dat je "${item}" wilt verwijderen?`)) {
        alert(`Verwijderen van filter item: ${item} - implementatie volgt`);
    }
}

function closeModal() {
    const modal = document.getElementById('userModal');
    if (modal) {
        modal.remove();
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', function() {
    window.adminDashboard = new AdminDashboard();
});
