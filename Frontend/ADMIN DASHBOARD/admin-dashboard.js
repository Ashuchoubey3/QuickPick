// Frontend/ADMIN DASHBOARD/script.js
document.addEventListener('DOMContentLoaded', function() {
    const BACKEND_URL = 'http://localhost:5001'; // Your backend Express URL

    // --- DOM Elements ---
    const sidebarLinks = document.querySelectorAll('.sidebar-link');
    const contentSections = document.querySelectorAll('.content-section');
    const logoutBtn = document.getElementById('logout-btn');

    // Overview section elements
    const totalBuyersCountSpan = document.getElementById('total-buyers-count');
    const totalSellersCountSpan = document.getElementById('total-sellers-count');
    const totalProductsCountSpan = document.getElementById('total-products-count');
    const pendingSellersTableBody = document.getElementById('pending-sellers-table-body');

    // Manage Users section elements
    const buyersTableBody = document.getElementById('buyers-table-body');
    const noBuyersMessage = document.getElementById('no-buyers-message');
    const sellersTableBody = document.getElementById('sellers-table-body');
    const noSellersMessage = document.getElementById('no-sellers-message');
    const userTabs = document.getElementById('userTabs'); // For tab click events

    // Manage Products section elements
    const allProductsTableBody = document.getElementById('all-products-table-body');
    const noAllProductsMessage = document.getElementById('no-all-products-message');

    // --- Helper Functions ---

    /**
     * Fetches the JWT token from localStorage.
     * @returns {string|null} The token string or null if not found.
     */
    function getToken() {
        return localStorage.getItem('quickpickToken');
    }

    /**
     * Retrieves and parses user data from localStorage.
     * @returns {object|null} The parsed user object or null if not found/invalid.
     */
    function getUserData() {
        const userString = localStorage.getItem('quickpickUser');
        if (userString) {
            try {
                return JSON.parse(userString);
            } catch (e) {
                console.error('Error parsing user data from localStorage:', e);
                return null;
            }
        }
        return null;
    }

    /**
     * Displays a temporary message (e.g., success/error alert).
     * @param {HTMLElement} targetElement - The element to append the message to.
     * @param {string} message - The message text.
     * @param {string} type - 'success', 'danger', 'warning', 'info'.
     * @param {number} duration - Duration in milliseconds before fading out.
     */
    function showTemporaryMessage(targetElement, message, type = 'info', duration = 3000) {
        // Ensure the targetElement exists before trying to manipulate it
        if (!targetElement) {
            console.warn('showTemporaryMessage called with null targetElement:', message);
            return;
        }

        // Clear any existing messages in this container
        targetElement.innerHTML = '';

        const alertDiv = document.createElement('div');
        const typeClasses = {
            'success': 'alert alert-success',
            'danger': 'alert alert-danger',
            'warning': 'alert alert-warning',
            'info': 'alert alert-info'
        };
        alertDiv.className = `${typeClasses[type]} alert-dismissible fade show`;
        alertDiv.setAttribute('role', 'alert');
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        targetElement.appendChild(alertDiv);

        setTimeout(() => {
            if (alertDiv.classList.contains('show')) {
                const bsAlert = bootstrap.Alert.getInstance(alertDiv) || new bootstrap.Alert(alertDiv);
                bsAlert.close();
            }
        }, duration);
    }

    /**
     * Fetches data from a given API endpoint.
     * Handles authentication and error redirection.
     * @param {string} endpoint - The API endpoint path.
     * @param {string} method - HTTP method (GET, POST, PUT, DELETE).
     * @param {object} body - Request body for POST/PUT.
     * @returns {Promise<object>} The JSON response data.
     */
    async function fetchData(endpoint, method = 'GET', body = null) {
        const token = getToken();
        if (!token) {
            console.error('No authentication token found. Redirecting to login.');
            window.location.href = `${window.origin}/Frontend/Register-login/register-login.html`; // Redirect to login
            return null;
        }

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };

        const options = {
            method,
            headers
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        try {
            const response = await fetch(`${BACKEND_URL}${endpoint}`, options);
            const data = await response.json();

            if (!response.ok) {
                // If token expired or unauthorized, redirect to login
                if (response.status === 401 || response.status === 403) {
                     console.error('Unauthorized or forbidden access. Redirecting to login.');
                     localStorage.removeItem('quickpickToken');
                     localStorage.removeItem('quickpickUser');
                     window.location.href = `${window.origin}/Frontend/Register-login/register-login.html`;
                     return null; // Stop further processing if redirected
                }
                throw new Error(data.message || `API Error: ${response.statusText}`);
            }
            return data;
        } catch (error) {
            console.error(`Error fetching ${endpoint}:`, error.message);
            // Admin dashboard might not have a specific message container for general errors
            // Using a generic content-section element for now. You might want to add a dedicated one.
            showTemporaryMessage(document.querySelector('.dashboard-content'), `Error: ${error.message}`, 'danger', 5000);
            return null;
        }
    }

    /**
     * Checks if the user is a logged-in admin.
     * If not, redirects to login page.
     */
    function checkAdminStatus() {
        const user = getUserData();
        if (!user || user.role !== 'admin') {
            console.error('User is not an admin or not logged in. Redirecting.');
            window.location.href = `${window.origin}/Frontend/Register-login/register-login.html`;
            return false;
        }
        return true;
    }

    // --- SECTION VISIBILITY LOGIC ---
    /**
     * Hides all content sections and shows the target section.
     * Also updates the active state of sidebar links.
     * @param {string} targetId - The ID of the section to show (e.g., 'overview-section').
     */
    function showSection(targetId) {
        contentSections.forEach(section => {
            section.classList.add('d-none');
        });

        sidebarLinks.forEach(link => {
            link.classList.remove('active');
        });

        const targetSection = document.getElementById(targetId);
        if (targetSection) {
            targetSection.classList.remove('d-none');
            const correspondingLink = document.querySelector(`.sidebar-link[data-target="${targetId}"]`);
            if (correspondingLink) {
                correspondingLink.classList.add('active');
            }

            // Load data specific to the activated section
            switch (targetId) {
                case 'overview-section':
                    loadOverviewData();
                    break;
                case 'manage-users-section':
                    // Activate the default tab (Buyers)
                    const buyersTab = document.getElementById('buyers-tab');
                    if (buyersTab) {
                        new bootstrap.Tab(buyersTab).show(); // Programmatically show the tab
                    }
                    loadAllUsers(); // Load all users when manage users section is activated
                    break;
                case 'manage-products-section':
                    loadAllProducts();
                    break;
                // Add cases for other sections if they need data loaded on view
            }
        } else {
            console.warn(`Section with ID "${targetId}" not found.`);
        }
    }

    // --- Data Loading Functions ---

    /**
     * Loads counts for buyers, sellers, products and pending sellers for overview.
     */
    async function loadOverviewData() {
        // Fetch all buyers
        const buyers = await fetchData('/api/admin/users/buyers');
        if (buyers) {
            totalBuyersCountSpan.textContent = buyers.length;
        } else {
            totalBuyersCountSpan.textContent = '0';
        }

        // Fetch all sellers
        const sellers = await fetchData('/api/admin/users/sellers');
        if (sellers) {
            totalSellersCountSpan.textContent = sellers.length;
            // Populate pending sellers table for overview
            populatePendingSellersTable(sellers);
        } else {
            totalSellersCountSpan.textContent = '0';
            pendingSellersTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No pending approvals.</td></tr>';
        }

        // Fetch all products
        const products = await fetchData('/api/products/admin'); // Assuming an admin endpoint for all products
        if (products) {
            totalProductsCountSpan.textContent = products.length;
        } else {
            totalProductsCountSpan.textContent = '0';
        }
    }

    /**
     * Populates the pending sellers table in the overview section.
     * @param {Array} sellers - List of all sellers.
     */
    function populatePendingSellersTable(sellers) {
        pendingSellersTableBody.innerHTML = ''; // Clear existing rows
        const pendingSellers = sellers.filter(seller => !seller.isApproved);

        if (pendingSellers.length > 0) {
            pendingSellers.forEach(seller => {
                const row = `
                    <tr>
                        <td>${seller._id.substring(0, 8)}...</td>
                        <td>${seller.shopName || seller.firstName || 'N/A'}</td>
                        <td>${seller.email}</td>
                        <td>${new Date(seller.createdAt).toLocaleDateString()}</td>
                        <td>
                            <button class="btn btn-sm btn-success me-2 btn-approve-seller" data-user-id="${seller._id}">Approve</button>
                            <button class="btn btn-sm btn-danger btn-decline-seller" data-user-id="${seller._id}">Decline</button>
                        </td>
                    </tr>
                `;
                pendingSellersTableBody.insertAdjacentHTML('beforeend', row);
            });
        } else {
            pendingSellersTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No pending approvals.</td></tr>';
        }
    }


    /**
     * Loads all buyers and sellers and populates their respective tables.
     */
    async function loadAllUsers() {
        // Load Buyers
        buyersTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Loading buyers...</td></tr>';
        noBuyersMessage.classList.add('d-none');
        const buyers = await fetchData('/api/admin/users/buyers');
        buyersTableBody.innerHTML = '';
        if (buyers && buyers.length > 0) {
            buyers.forEach(buyer => {
                const row = `
                    <tr>
                        <td>${buyer._id.substring(0, 8)}...</td>
                        <td>${buyer.firstName} ${buyer.lastName}</td>
                        <td>${buyer.email}</td>
                        <td>${new Date(buyer.createdAt).toLocaleDateString()}</td>
                        <td>
                            <button class="btn btn-sm btn-danger btn-delete-user" data-user-id="${buyer._id}" data-user-role="buyer">Delete</button>
                        </td>
                    </tr>
                `;
                buyersTableBody.insertAdjacentHTML('beforeend', row);
            });
        } else {
            noBuyersMessage.classList.remove('d-none');
        }

        // Load Sellers
        sellersTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Loading sellers...</td></tr>';
        noSellersMessage.classList.add('d-none');
        const sellers = await fetchData('/api/admin/users/sellers');
        sellersTableBody.innerHTML = '';
        if (sellers && sellers.length > 0) {
            sellers.forEach(seller => {
                const statusBadge = seller.isApproved ?
                    '<span class="badge bg-success">Approved</span>' :
                    '<span class="badge bg-warning">Pending</span>';
                const actions = seller.isApproved ?
                    `<button class="btn btn-sm btn-danger btn-delete-user" data-user-id="${seller._id}" data-user-role="seller">Delete</button>` :
                    `<button class="btn btn-sm btn-success me-2 btn-approve-seller" data-user-id="${seller._id}">Approve</button>
                     <button class="btn btn-sm btn-danger btn-decline-seller" data-user-id="${seller._id}">Decline</button>`; // Decline button for pending
                const row = `
                    <tr>
                        <td>${seller._id.substring(0, 8)}...</td>
                        <td>${seller.shopName || `${seller.firstName} ${seller.lastName}`}</td>
                        <td>${seller.email}</td>
                        <td>${statusBadge}</td>
                        <td>${new Date(seller.createdAt).toLocaleDateString()}</td>
                        <td>${actions}</td>
                    </tr>
                `;
                sellersTableBody.insertAdjacentHTML('beforeend', row);
            });
        } else {
            noSellersMessage.classList.remove('d-none');
        }
    }

    /**
     * Loads all products from the backend (for admin view) and populates the table.
     */
    async function loadAllProducts() {
        allProductsTableBody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">Loading products...</td></tr>';
        noAllProductsMessage.classList.add('d-none');

        const products = await fetchData('/api/products/admin'); // Assuming an admin endpoint for all products

        allProductsTableBody.innerHTML = '';
        if (products && products.length > 0) {
            products.forEach(product => {
                const statusBadge = product.isAvailable ?
                    '<span class="badge bg-success">In Stock</span>' :
                    '<span class="badge bg-danger">Out of Stock</span>';
                const row = `
                    <tr>
                        <td>${product._id.substring(0, 8)}...</td>
                        <td>${product.name}</td>
                        <td>${product.category}</td>
                        <td>$${product.price.toFixed(2)}</td>
                        <td>${product.stock}</td>
                        <td>${product.seller ? (product.seller.shopName || product.seller.firstName || 'N/A') : 'N/A'}</td>
                        <td>${statusBadge}</td>
                        <td>
                            <button class="btn btn-sm btn-danger btn-delete-product" data-product-id="${product._id}">Delete</button>
                        </td>
                    </tr>
                `;
                allProductsTableBody.insertAdjacentHTML('beforeend', row);
            });
        } else {
            noAllProductsMessage.classList.remove('d-none');
        }
    }


    // --- Action Handlers (Approve/Decline/Delete) ---

    /**
     * Handles approving a seller.
     * @param {string} sellerId - The ID of the seller to approve.
     */
    async function handleApproveSeller(sellerId) {
        // You might want a confirmation dialog here
        if (confirm('Are you sure you want to approve this seller?')) {
            const result = await fetchData(`/api/admin/users/sellers/${sellerId}/approve`, 'PUT');
            if (result && result.message) {
                showTemporaryMessage(document.querySelector('.dashboard-content'), result.message, 'success');
                // Refresh relevant sections
                loadOverviewData();
                loadAllUsers();
            } else {
                showTemporaryMessage(document.querySelector('.dashboard-content'), 'Failed to approve seller.', 'danger');
            }
        }
    }

    /**
     * Handles declining a seller (marks as not approved, keeps account).
     * @param {string} sellerId - The ID of the seller to decline.
     */
    async function handleDeclineSeller(sellerId) {
        if (confirm('Are you sure you want to decline this seller? This will set their approval status to false.')) {
            const result = await fetchData(`/api/admin/users/sellers/${sellerId}/decline`, 'PUT');
            if (result && result.message) {
                showTemporaryMessage(document.querySelector('.dashboard-content'), result.message, 'warning');
                loadOverviewData();
                loadAllUsers();
            } else {
                showTemporaryMessage(document.querySelector('.dashboard-content'), 'Failed to decline seller.', 'danger');
            }
        }
    }


    /**
     * Handles deleting a user (buyer or seller).
     * @param {string} userId - The ID of the user to delete.
     * @param {string} userRole - The role of the user ('buyer' or 'seller').
     */
    async function handleDeleteUser(userId, userRole) {
        if (confirm(`Are you sure you want to delete this ${userRole} account? This action cannot be undone.`)) {
            const endpoint = `/api/admin/users/${userRole}s/${userId}`;
            const result = await fetchData(endpoint, 'DELETE');
            if (result && result.message) {
                showTemporaryMessage(document.querySelector('.dashboard-content'), result.message, 'success');
                // Refresh relevant sections
                loadOverviewData();
                loadAllUsers();
            } else {
                showTemporaryMessage(document.querySelector('.dashboard-content'), `Failed to delete ${userRole}.`, 'danger');
            }
        }
    }

    /**
     * Handles deleting a product.
     * @param {string} productId - The ID of the product to delete.
     */
    async function handleDeleteProduct(productId) {
        if (confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
            const result = await fetchData(`/api/products/${productId}`, 'DELETE'); // Assuming admin can delete any product via this route
            if (result && result.message) {
                showTemporaryMessage(document.querySelector('.dashboard-content'), result.message, 'success');
                // Refresh relevant sections
                loadOverviewData();
                loadAllProducts();
            } else {
                showTemporaryMessage(document.querySelector('.dashboard-content'), 'Failed to delete product.', 'danger');
            }
        }
    }


    // --- Event Handlers ---

    // Logout Functionality
    logoutBtn.addEventListener('click', function(event) {
        event.preventDefault();
        localStorage.removeItem('quickpickToken');
        localStorage.removeItem('quickpickUser');
        window.location.href = `${window.origin}/Frontend/Register-login/register-login.html`;
    });

    // Sidebar navigation clicks
    sidebarLinks.forEach(link => {
        link.addEventListener('click', function(event) {
            event.preventDefault();
            const targetId = this.dataset.target;
            if (targetId) {
                showSection(targetId);
            }
        });
    });

    // Event delegation for user tables (approve/decline/delete buttons)
    document.body.addEventListener('click', async function(event) {
        const target = event.target;
        const userId = target.dataset.userId;
        const userRole = target.dataset.userRole; // 'buyer' or 'seller'
        const productId = target.dataset.productId;

        // User management actions
        if (target.classList.contains('btn-approve-seller')) {
            if (userId) {
                await handleApproveSeller(userId);
            }
        } else if (target.classList.contains('btn-decline-seller')) {
            if (userId) {
                await handleDeclineSeller(userId);
            }
        } else if (target.classList.contains('btn-delete-user')) {
            if (userId && userRole) {
                await handleDeleteUser(userId, userRole);
            }
        }
        // Product management actions
        else if (target.classList.contains('btn-delete-product')) {
            if (productId) {
                await handleDeleteProduct(productId);
            }
        }
    });


    // --- Initialization ---
    async function initializeAdminDashboard() {
        if (checkAdminStatus()) { // Only proceed if user is an admin
            showSection('overview-section'); // Show the default section (Dashboard/Overview)
        }
    }

    initializeAdminDashboard();
});
