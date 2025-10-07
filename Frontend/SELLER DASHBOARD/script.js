document.addEventListener('DOMContentLoaded', function() {
    const BACKEND_URL = 'http://localhost:5001'; // Your backend Express URL
    const SOCKET_IO_URL = 'http://localhost:5001'; // Your Socket.IO server URL (usually same as backend)

    const sidebarLinks = document.querySelectorAll('.sidebar-link');
    const contentSections = document.querySelectorAll('.content-section');
    const logoutBtn = document.getElementById('logout-btn');

    const totalProductsCountSpan = document.getElementById('total-products-count');

    const myProductsTableBody = document.getElementById('my-products-table-body');
    const noProductsMessage = document.getElementById('no-products-message');

    const addProductForm = document.getElementById('add-product-form');
    const productMessageContainer = document.getElementById('product-message-container');

    const messagesSidebarLink = document.getElementById('messages-sidebar-link');
    const totalUnreadMessagesBadge = document.getElementById('total-unread-messages');
    const chatList = document.getElementById('chat-list');
    const noChatsMessage = document.getElementById('no-chats-message');
    const chatHeaderName = document.getElementById('chat-header-name');
    const chatHeaderProduct = document.getElementById('chat-header-product');
    const chatMessagesDiv = document.getElementById('chat-messages');
    const chatMessageInput = document.getElementById('chat-message-input');
    const chatSendBtn = document.getElementById('chat-send-btn');
    const chatMessageContainer = document.getElementById('chat-message-container');


    let currentUserId = null;
    let currentUserRole = null;
    let activeChatId = null; // Stores the ID of the currently open chat
    let socket = null; // Socket.IO client instance

    function getToken() {
        console.log("object")
        return localStorage.getItem('quickpickToken');
    }

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

    function showTemporaryMessage(targetElement, message, type = 'info', duration = 3000) {
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
            showTemporaryMessage(document.querySelector('.dashboard-content'), `Error: ${error.message}`, 'danger', 5000);
            return null;
        }
    }

    function checkSellerStatus() {
        const user = getUserData();
        if (!user || user.role !== 'seller') {
            console.error('User is not a seller or not logged in. Redirecting.');
            window.location.href = `${window.origin}/Frontend/Register-login/register-login.html`;
            return false;
        }
        if (!user.isApproved) {
            console.warn('Seller account is not approved. Redirecting.');
            alert('Your seller account is pending admin approval.'); // Provide user feedback
            window.location.href = `${window.origin}/Frontend/Register-login/register-login.html`;
            return false;
        }
        currentUserId = user.id; // Store the seller's ID
        currentUserRole = user.role;
        return true;
    }


    function showSection(targetId) {
        // Clear message polling interval when switching away from chat
        if (activeChatId && socket) {
            socket.emit('leaveChat', activeChatId);
            activeChatId = null; // Clear active chat
        }

        // Hide all sections by adding 'd-none' class
        contentSections.forEach(section => {
            section.classList.add('d-none');
        });

        // Remove 'active' class from all sidebar links
        sidebarLinks.forEach(link => {
            link.classList.remove('active');
        });

        // Show the target section by removing 'd-none' class and activate its link
        const targetSection = document.getElementById(targetId);
        if (targetSection) {
            targetSection.classList.remove('d-none'); // Show the section
            const correspondingLink = document.querySelector(`.sidebar-link[data-target="${targetId}"]`);
            if (correspondingLink) {
                correspondingLink.classList.add('active');
            }

            // Load data specific to the activated section
            switch (targetId) {
                case 'overview-section':
                    loadTotalProductsCount(); // Update product count in overview
                    // You might also load recent orders or product stats here
                    break;
                case 'my-products-section':
                    loadMyProducts();
                    break;
                case 'add-new-product-section':
                    addProductForm.reset(); // Clear the form
                    productMessageContainer.innerHTML = ''; // Clear previous messages
                    break;
                case 'messages-section': // NEW: Load chat list when messages section is shown
                    loadChatList();
                    // Set up initial empty state for message display
                    chatMessagesDiv.innerHTML = '<p class="text-center text-muted">Select a chat to view messages.</p>';
                    chatHeaderName.textContent = 'Select a Chat';
                    chatHeaderProduct.textContent = '';
                    break;
                // Add cases for other sections if they need data loaded on view
            }
        } else {
            console.warn(`Section with ID "${targetId}" not found.`);
        }
    }

    async function loadTotalProductsCount() {
        if (!currentUserId) return;

        const products = await fetchData(`/api/products/seller/${currentUserId}`);
        if (products) {
            totalProductsCountSpan.textContent = products.length;
        } else {
            totalProductsCountSpan.textContent = '0';
        }
    }

    async function loadMyProducts() {
        if (!currentUserId) {
            myProductsTableBody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Seller ID not found.</td></tr>';
            return;
        }

        myProductsTableBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Loading products...</td></tr>'; // Loading message
        noProductsMessage.classList.add('d-none'); // Hide no products message

        const products = await fetchData(`/api/products/seller/${currentUserId}`);

        myProductsTableBody.innerHTML = ''; // Clear existing rows
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
                        <td>${statusBadge}</td>
                        <td>
                            <button class="btn btn-sm btn-info me-2 btn-view-product" data-product-id="${product._id}">View</button>
                            <button class="btn btn-sm btn-warning me-2 btn-edit-product" data-product-id="${product._id}">Edit</button>
                            <button class="btn btn-sm btn-danger btn-delete-product" data-product-id="${product._id}">Delete</button>
                        </td>
                    </tr>
                `;
                myProductsTableBody.insertAdjacentHTML('beforeend', row);
            });
            noProductsMessage.classList.add('d-none'); // Ensure it's hidden
        } else {
            myProductsTableBody.innerHTML = ''; // Ensure table is empty
            noProductsMessage.classList.remove('d-none'); // Show no products message
        }
        loadTotalProductsCount(); // Update the count after loading products
    }


    async function handleAddProduct(event) {
        event.preventDefault(); // Prevent default form submission

        const formData = new FormData(addProductForm);
        const productData = Object.fromEntries(formData.entries());

        // Convert price and stock to numbers
        productData.price = parseFloat(productData.price);
        productData.stock = parseInt(productData.stock, 10);
        if (!productData.name || !productData.description || isNaN(productData.price) || isNaN(productData.stock) || !productData.category) {
            showTemporaryMessage(productMessageContainer, 'Please fill in all required fields correctly.', 'danger');
            return;
        }

        const addedProduct = await fetchData('/api/products', 'POST', productData);

        if (addedProduct) {
            showTemporaryMessage(productMessageContainer, `Product "${addedProduct.product.name}" added successfully!`, 'success');
            addProductForm.reset(); // Clear the form
            // Automatically switch to 'My Products' and refresh the list
            showSection('my-products-section');
        } else {
            // Error message already handled by fetchData
        }
    }

   async function loadChatList() {
        chatList.innerHTML = '<p class="text-center text-muted mt-3">Loading chats...</p>';
        noChatsMessage.classList.add('d-none'); // Hide the "No active chats" message initially
        totalUnreadMessagesBadge.classList.add('d-none'); // Hide total unread badge initially

        const chats = await fetchData('/api/chat/list');
        chatList.innerHTML = ''; // Clear previous list items
        let totalUnread = 0;

        if (chats && chats.length > 0) {
            chats.forEach(chat => {
                const lastMsgTime = chat.lastMessageTimestamp ? new Date(chat.lastMessageTimestamp).toLocaleString() : 'No messages';
                const unreadBadge = chat.unreadCount > 0 ?
                    `<span class="badge bg-danger rounded-pill unread-badge">${chat.unreadCount}</span>` : '';
                
                const chatItem = document.createElement('a');
                chatItem.href = '#';
                chatItem.classList.add('list-group-item', 'list-group-item-action', 'chat-list-item');
                chatItem.setAttribute('data-chat-id', chat.chatId);
                chatItem.setAttribute('data-other-participant-id', chat.otherParticipantId);
                chatItem.setAttribute('data-other-participant-name', chat.otherParticipantName);
                chatItem.setAttribute('data-product-id', chat.productId); // Store product ID for context
                chatItem.setAttribute('data-product-name', chat.productName || ''); // Store product name for display
                chatItem.innerHTML = `
                    <div class="d-flex w-100 justify-content-between align-items-center">
                        <h6 class="mb-0">${chat.otherParticipantName}</h6>
                        ${unreadBadge}
                    </div>
                    ${chat.productName ? `<small class="text-info">${chat.productName}</small><br>` : ''}
                    <p class="mb-1 text-truncate" style="font-size: 0.9em;">${chat.lastMessageText || 'Start a conversation!'}</p>
                    <small class="text-muted">${lastMsgTime}</small>
                `;
                chatList.appendChild(chatItem);

                totalUnread += chat.unreadCount;
            });
            noChatsMessage.classList.add('d-none'); // Ensure it remains hidden
            if (totalUnread > 0) {
                totalUnreadMessagesBadge.textContent = totalUnread;
                totalUnreadMessagesBadge.classList.remove('d-none');
            }
        } else {
            noChatsMessage.classList.remove('d-none'); // Show "No active chats" message
            totalUnreadMessagesBadge.classList.add('d-none');
        }
    }

    async function loadMessages(chatId) {
        if (!chatId) {
            chatMessagesDiv.innerHTML = '<p class="text-center text-muted">Select a chat to view messages.</p>';
            chatHeaderName.textContent = 'Select a Chat';
            chatHeaderProduct.textContent = '';
            activeChatId = null;
            return;
        }

        // Leave previous chat room if any, and join the new one
        if (activeChatId && activeChatId !== chatId && socket && socket.connected) {
            socket.emit('leaveChat', activeChatId);
        }
        if (socket && socket.connected) {
            socket.emit('joinChat', chatId);
        }
        activeChatId = chatId; // Set current active chat

        chatMessagesDiv.innerHTML = '<p class="text-center text-muted">Loading messages...</p>'; // Loading message
        chatMessageInput.value = ''; // Clear input field

        const messages = await fetchData(`/api/chat/messages/${chatId}`);

        chatMessagesDiv.innerHTML = ''; // Clear existing messages
        if (messages && messages.length > 0) {
            messages.forEach(msg => {
                appendMessageToUI(msg);
            });
            chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight; // Scroll to bottom
        } else {
            chatMessagesDiv.innerHTML = '<p class="text-center text-muted">No messages yet. Start typing!</p>';
        }

        // Mark messages as read on the backend (after loading them)
        await fetchData(`/api/chat/${chatId}/mark-read`, 'POST');
        loadChatList(); // Refresh chat list to update unread counts
    }

    /**
     * Appends a message to the chat UI.
     * @param {object} msg - The message object.
     */
    function appendMessageToUI(msg) {
        const messageClass = msg.sender === currentUserId ? 'sent' : 'received';
        // Format timestamp
        const msgDate = new Date(msg.timestamp);
        const msgTime = msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const messageHtml = `
            <div class="message ${messageClass}">
                <div class="message-text">${msg.text}</div>
                <div class="message-timestamp">${msgTime}</div>
            </div>
        `;
        chatMessagesDiv.insertAdjacentHTML('beforeend', messageHtml);
        chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight; // Keep scrolled to bottom
    }

    async function sendMessage() {
        if (!activeChatId) {
            showTemporaryMessage(chatMessageContainer, 'No chat selected.', 'danger');
            return;
        }

        const messageText = chatMessageInput.value.trim();
        if (!messageText) {
            showTemporaryMessage(chatMessageContainer, 'Message cannot be empty.', 'warning');
            return;
        }

        // Emit message via Socket.IO
        socket.emit('sendMessage', {
            chatId: activeChatId,
            senderId: currentUserId,
            senderRole: currentUserRole,
            text: messageText
        });

        // Optimistically add message to UI (Socket.IO server will confirm)
        const optimisticMessage = {
            sender: currentUserId,
            text: messageText,
            timestamp: new Date() // Use current time for optimistic display
        };
        appendMessageToUI(optimisticMessage);
        chatMessageInput.value = ''; // Clear input

        // Refresh chat list to update last message/timestamp (even if unread count doesn't change for sender)
        loadChatList();
    }


    // --- Socket.IO Event Listeners ---
    function setupSocketListeners() {
        if (!socket) {
            const token = getToken();
            const user = getUserData();
            if (!token || !user) {
                console.error('Cannot establish socket connection: User not authenticated.');
                return;
            }

            // Pass token, userId, and userRole in the handshake query for authentication/authorization on backend
            socket = io(SOCKET_IO_URL, {
                query: {
                    token: token,
                    userId: user.id,
                    userRole: user.role
                }
            });

            socket.on('connect', () => {
                console.log('Connected to Socket.IO server:', socket.id);
            });

            socket.on('disconnect', () => {
                console.log('Disconnected from Socket.IO server.');
            });

            socket.on('connect_error', (err) => {
                console.error('Socket.IO connection error:', err.message);
                showTemporaryMessage(document.querySelector('.dashboard-content'), 'Chat service unavailable. Please try again later.', 'danger');
            });

            // Listen for incoming messages
            socket.on('receiveMessage', (message) => {
                console.log('Received message:', message);
                // FIX: Only append if it's not the current user's own message (optimistically added already)
                // And if it's for the currently active chat
                if (message.chatRoom === activeChatId && message.sender !== currentUserId) {
                    appendMessageToUI(message);
                    // Mark as read immediately if current chat and it's a new message from someone else
                    fetchData(`/api/chat/${activeChatId}/mark-read`, 'POST').then(() => {
                        loadChatList(); // Refresh chat list to update unread badge
                    });
                } else if (message.chatRoom !== activeChatId) {
                    // Message for another chat, just refresh chat list to show unread badge
                    loadChatList();
                }

            });

            socket.on('messageFailed', (data) => {
                console.error('Message failed to send:', data.error);
                showTemporaryMessage(chatMessageContainer, `Failed to send message: ${data.error}`, 'danger');

            });
        }
    }


    logoutBtn.addEventListener('click', function(event) {
        event.preventDefault();
        localStorage.removeItem('quickpickToken');
        localStorage.removeItem('quickpickUser');
        if (socket) {
            socket.disconnect(); // Disconnect socket on logout
        }
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

    // Add Product Form submission
    addProductForm.addEventListener('submit', handleAddProduct);

    // Event delegation for "My Products" table actions (View, Edit, Delete)
    myProductsTableBody.addEventListener('click', function(event) {
        const target = event.target;
        const productId = target.dataset.productId;

        if (target.classList.contains('btn-view-product')) {
            alert(`View Product: ${productId}`);
            // Implement logic to view product details (e.g., open a modal, navigate to product page)
        } else if (target.classList.contains('btn-edit-product')) {
            alert(`Edit Product: ${productId}`);
            // Implement logic to edit product (e.g., populate a form, navigate to edit page)
        } else if (target.classList.contains('btn-delete-product')) {
            if (confirm('Are you sure you want to delete this product?')) {
                // Implement delete product functionality
                // Example: fetchData(`/api/products/${productId}`, 'DELETE').then(() => loadMyProducts());
                alert(`Delete Product: ${productId} (Not implemented yet)`);
            }
        }
    });

    // Event delegation for Chat List clicks (to open a specific chat)
    chatList.addEventListener('click', function(event) {
        const target = event.target.closest('.chat-list-item');
        if (target) {
            const chatId = target.dataset.chatId;
            const otherParticipantName = target.dataset.otherParticipantName;
            const productName = target.dataset.productName; // Get product name

            // Update active state in chat list
            chatList.querySelectorAll('.chat-list-item').forEach(item => item.classList.remove('active'));
            target.classList.add('active');

            chatHeaderName.textContent = otherParticipantName;
            chatHeaderProduct.textContent = productName ? `(Product: ${productName})` : '';
            loadMessages(chatId); // Load messages for the selected chat
        }
    });

    // Send Message on button click
    chatSendBtn.addEventListener('click', sendMessage);

    // Send Message on Enter key press in input field
    chatMessageInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault(); // Prevent new line in input
            sendMessage();
        }
    });


    // --- Initialization ---
    async function initializeSellerDashboard() {
        if (checkSellerStatus()) { // Only proceed if user is an approved seller
            setupSocketListeners(); // Initialize Socket.IO connection
            // Show the default section (Dashboard/Overview)
            showSection('overview-section');
        }
    }

    initializeSellerDashboard();
});
