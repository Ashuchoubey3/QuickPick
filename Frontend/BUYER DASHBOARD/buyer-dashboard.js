document.addEventListener("DOMContentLoaded", function () {
  const BACKEND_URL = "http://localhost:5001";
  const SOCKET_IO_URL = "http://localhost:5001";

  const sidebarLinks = document.querySelectorAll(".sidebar-link");
  const contentSections = document.querySelectorAll(".content-section");
  const logoutBtn = document.getElementById("logout-btn");

  const allProductsGrid = document.getElementById("all-products-grid");
  const noAllProductsMessage = document.getElementById(
    "no-all-products-message"
  );
  const recommendationProductNameInput = document.getElementById(
    "recommendation-product-name"
  );
  const getRecommendationBtn = document.getElementById(
    "get-recommendation-btn"
  );
  const recommendationResultDiv = document.getElementById(
    "recommendation-result"
  );
  const recommendationLoadingDiv = document.getElementById(
    "recommendation-loading"
  );
  const recommendationMessageContainer = document.getElementById(
    "recommendation-message-container"
  );
  const messagesSidebarLink = document.getElementById("messages-sidebar-link");
  const totalUnreadMessagesBadge = document.getElementById(
    "total-unread-messages"
  );
  const chatList = document.getElementById("chat-list");
  const noChatsMessage = document.getElementById("no-chats-message");
  const chatHeaderName = document.getElementById("chat-header-name");
  const chatHeaderProduct = document.getElementById("chat-header-product");
  const chatMessagesDiv = document.getElementById("chat-messages");
  const chatMessageInput = document.getElementById("chat-message-input");
  const chatSendBtn = document.getElementById("chat-send-btn");
  const chatMessageContainer = document.getElementById(
    "chat-message-container"
  );

  let currentUserId = null;
  let currentUserRole = null;
  let activeChatId = null;
  let socket = null;

  function getToken() {
    return localStorage.getItem("quickpickToken");
  }

  function getUserData() {
    const userString = localStorage.getItem("quickpickUser");
    if (userString) {
      try {
        return JSON.parse(userString);
      } catch (e) {
        console.error("Error parsing user data from localStorage:", e);
        return null;
      }
    }
    return null;
  }

  function showTemporaryMessage(
    targetElement,
    message,
    type = "info",
    duration = 3000
  ) {
    targetElement.innerHTML = "";

    const alertDiv = document.createElement("div");
    const typeClasses = {
      success: "alert alert-success",
      danger: "alert alert-danger",
      warning: "alert alert-warning",
      info: "alert alert-info",
    };
    alertDiv.className = `${typeClasses[type]} alert-dismissible fade show`;
    alertDiv.setAttribute("role", "alert");
    alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
    targetElement.appendChild(alertDiv);

    setTimeout(() => {
      if (alertDiv.classList.contains("show")) {
        const bsAlert =
          bootstrap.Alert.getInstance(alertDiv) ||
          new bootstrap.Alert(alertDiv);
        bsAlert.close();
      }
    }, duration);
  }

  async function fetchData(endpoint, method = "GET", body = null) {
    const token = getToken();
    if (!token) {
      console.error("No authentication token found. Redirecting to login.");
      window.location.href = `${window.origin}/Frontend/Register-login/register-login.html`; // Redirect to login
      return null;
    }

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    const options = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(`${BACKEND_URL}${endpoint}`, options);
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          console.error(
            "Unauthorized or forbidden access. Redirecting to login."
          );
          localStorage.removeItem("quickpickToken");
          localStorage.removeItem("quickpickUser");
          window.location.href = `${window.origin}/Frontend/Register-login/register-login.html`;
          return null;
        }
        throw new Error(data.message || `API Error: ${response.statusText}`);
      }
      return data;
    } catch (error) {
      console.error(`Error fetching ${endpoint}:`, error.message);
      showTemporaryMessage(
        document.querySelector(".dashboard-content"),
        `Error: ${error.message}`,
        "danger",
        5000
      );
      return null;
    }
  }

  function checkBuyerStatus() {
    const user = getUserData();
    if (!user || user.role !== "buyer") {
      console.error("User is not a buyer or not logged in. Redirecting.");
      window.location.href = `${window.origin}/Frontend/Register-login/register-login.html`;
      return false;
    }
    currentUserId = user.id;
    currentUserRole = user.role;
    return true;
  }

  function showSection(targetId) {
    if (activeChatId && socket) {
      socket.emit("leaveChat", activeChatId);
      activeChatId = null; // Clear active chat
    }

    contentSections.forEach((section) => {
      section.classList.add("d-none");
    });

    sidebarLinks.forEach((link) => {
      link.classList.remove("active");
    });

    const targetSection = document.getElementById(targetId);
    if (targetSection) {
      targetSection.classList.remove("d-none"); // Show the section
      const correspondingLink = document.querySelector(
        `.sidebar-link[data-target="${targetId}"]`
      );
      if (correspondingLink) {
        correspondingLink.classList.add("active");
      }

      switch (targetId) {
        case "overview-section":
          break;
        case "all-products-section":
          loadAllProducts();
          break;
        case "messages-section":
          loadChatList();
          chatMessagesDiv.innerHTML =
            '<p class="text-center text-muted">Select a chat to view messages.</p>';
          chatHeaderName.textContent = "Select a Chat";
          chatHeaderProduct.textContent = "";
          break;
      }
    } else {
      console.warn(`Section with ID "${targetId}" not found.`);
    }
  }

  async function loadAllProducts() {
    allProductsGrid.innerHTML =
      '<div class="col-12 text-center text-muted">Loading products...</div>';
    noAllProductsMessage.classList.add("d-none");

    const products = await fetchData("/api/products");
    console.log(products);
    allProductsGrid.innerHTML = "";
    if (products && products.length > 0) {
      products.forEach((product) => {
        const statusBadge = product.isAvailable
          ? '<span class="badge bg-success">In Stock</span>'
          : '<span class="badge bg-danger">Out of Stock</span>';

        const imageUrl =
          product.imageUrl ||
          `https://placehold.co/400x300/E0E0E0/333333?text=${encodeURIComponent(
            product.category.replace(/ /g, "+")
          )}`;

        const productCard = `
                    <div class="col">
                        <div class="product-card">
                            <img src="${imageUrl}" class="card-img-top" alt="${
          product.name
        }" onerror="this.onerror=null;this.src='https://placehold.co/400x300/E0E0E0/333333?text=No+Image';">
                            <div class="product-card-body">
                                <h5 class="product-card-title">${
                                  product.name
                                }</h5>
                                <p class="product-card-category">${
                                  product.category
                                }</p>
                                <p class="product-card-price">₹${product.price.toFixed(
                                  2
                                )}</p>
                                <p class="product-card-seller">Sold by: ${
                                  product.seller
                                    ? product.seller.shopName
                                    : "N/A"
                                }</p>
                                <div class="product-card-status">${statusBadge}</div>
                                <div class="product-card-footer mt-auto"> <!-- mt-auto pushes to bottom -->
                                    <button class="btn btn-sm btn-primary w-100 btn-add-to-cart" data-product-id="${
                                      product._id
                                    }">Add to Cart</button>
                                    <button class="btn btn-sm btn-outline-info w-100 mt-2 btn-chat-with-seller" data-seller-id="${
                                      product.seller._id
                                    }" data-product-id="${
          product._id
        }" data-seller-name="${
          product.seller.shopName || product.seller.firstName
        }">Chat with Seller</button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
        allProductsGrid.insertAdjacentHTML("beforeend", productCard);
      });
      noAllProductsMessage.classList.add("d-none");
    } else {
      allProductsGrid.innerHTML = "";
      noAllProductsMessage.classList.remove("d-none");
    }
  }

  async function getRecommendation() {
    const productName = recommendationProductNameInput.value.trim();
    if (!productName) {
      showTemporaryMessage(
        recommendationMessageContainer,
        "Please enter a product name to get a recommendation.",
        "warning"
      );
      recommendationResultDiv.classList.add("hidden");
      return;
    }

    recommendationResultDiv.classList.add("hidden");
    recommendationMessageContainer.innerHTML = "";
    recommendationLoadingDiv.style.display = "block";

    try {
      const data = await fetchData("/api/recommendations/product", "POST", {
        productName,
      });

      if (data && data.recommendation) {
        recommendationResultDiv.innerHTML = `<strong>AI Recommendation for "${productName}":</strong><br>${data.recommendation}`;
        recommendationResultDiv.classList.remove("hidden");
      } else {
        showTemporaryMessage(
          recommendationMessageContainer,
          "Could not get a recommendation at this time. Please try again.",
          "danger"
        );
      }
    } catch (error) {
      console.error("Error fetching AI recommendation from backend:", error);
      showTemporaryMessage(
        recommendationMessageContainer,
        "Failed to fetch AI recommendation. Network error or backend issue.",
        "danger"
      );
    } finally {
      recommendationLoadingDiv.style.display = "none";
    }
  }

  async function initiateChat(
    participantId,
    productId = null,
    participantName
  ) {
    const payload = {
      participantId: participantId,
      productId: productId,
    };
    const data = await fetchData("/api/chat/initiate", "POST", payload);
    if (data && data.chatId) {
      if (socket && socket.connected) {
        socket.emit("joinChat", data.chatId);
      }
      showTemporaryMessage(
        chatMessageContainer,
        `Chat with ${participantName} opened!`,
        "success"
      );
      return data.chatId;
    } else {
      showTemporaryMessage(
        chatMessageContainer,
        "Failed to open chat.",
        "danger"
      );
      return null;
    }
  }

  async function loadChatList() {
    chatList.innerHTML =
      '<p class="text-center text-muted mt-3">Loading chats...</p>';
    noChatsMessage.classList.add("d-none");
    totalUnreadMessagesBadge.classList.add("d-none");

    const chats = await fetchData("/api/chat/list");
    chatList.innerHTML = "";
    let totalUnread = 0;

    if (chats && chats.length > 0) {
      chats.forEach((chat) => {
        const lastMsgTime = chat.lastMessageTimestamp
          ? new Date(chat.lastMessageTimestamp).toLocaleString()
          : "No messages";
        const unreadBadge =
          chat.unreadCount > 0
            ? `<span class="badge bg-danger rounded-pill unread-badge">${chat.unreadCount}</span>`
            : "";

        const chatItem = document.createElement("a");
        chatItem.href = "#";
        chatItem.classList.add(
          "list-group-item",
          "list-group-item-action",
          "chat-list-item"
        );
        chatItem.setAttribute("data-chat-id", chat.chatId);
        chatItem.setAttribute(
          "data-other-participant-id",
          chat.otherParticipantId
        );
        chatItem.setAttribute(
          "data-other-participant-name",
          chat.otherParticipantName
        );
        chatItem.setAttribute("data-product-id", chat.productId);
        chatItem.setAttribute("data-product-name", chat.productName || "");
        chatItem.innerHTML = `
                    <div class="d-flex w-100 justify-content-between align-items-center">
                        <h6 class="mb-0">${chat.otherParticipantName}</h6>
                        ${unreadBadge}
                    </div>
                    ${
                      chat.productName
                        ? `<small class="text-info">${chat.productName}</small><br>`
                        : ""
                    }
                    <p class="mb-1 text-truncate" style="font-size: 0.9em;">${
                      chat.lastMessageText || "Start a conversation!"
                    }</p>
                    <small class="text-muted">${lastMsgTime}</small>
                `;
        chatList.appendChild(chatItem);

        totalUnread += chat.unreadCount;
      });
      noChatsMessage.classList.add("d-none");
      if (totalUnread > 0) {
        totalUnreadMessagesBadge.textContent = totalUnread;
        totalUnreadMessagesBadge.classList.remove("d-none");
      }
    } else {
      noChatsMessage.classList.remove("d-none");
      totalUnreadMessagesBadge.classList.add("d-none");
    }
  }

  async function loadMessages(chatId) {
    if (!chatId) {
      chatMessagesDiv.innerHTML =
        '<p class="text-center text-muted">Select a chat to view messages.</p>';
      chatHeaderName.textContent = "Select a Chat";
      chatHeaderProduct.textContent = "";
      activeChatId = null;
      return;
    }

    if (activeChatId && activeChatId !== chatId && socket && socket.connected) {
      socket.emit("leaveChat", activeChatId);
    }
    if (socket && socket.connected) {
      socket.emit("joinChat", chatId);
    }
    activeChatId = chatId;

    chatMessagesDiv.innerHTML =
      '<p class="text-center text-muted">Loading messages...</p>';
    chatMessageInput.value = "";

    const messages = await fetchData(`/api/chat/messages/${chatId}`);

    chatMessagesDiv.innerHTML = "";
    if (messages && messages.length > 0) {
      messages.forEach((msg) => {
        appendMessageToUI(msg);
      });
      chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
    } else {
      chatMessagesDiv.innerHTML =
        '<p class="text-center text-muted">No messages yet. Start typing!</p>';
    }

    await fetchData(`/api/chat/${chatId}/mark-read`, "POST");
    loadChatList();
  }

  function appendMessageToUI(msg) {
    const messageClass = msg.sender === currentUserId ? "sent" : "received";
    const msgDate = new Date(msg.timestamp);
    const msgTime = msgDate.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    const messageHtml = `
            <div class="message ${messageClass}">
                <div class="message-text">${msg.text}</div>
                <div class="message-timestamp">${msgTime}</div>
            </div>
        `;
    chatMessagesDiv.insertAdjacentHTML("beforeend", messageHtml);
    chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
  }

  async function sendMessage() {
    if (!activeChatId) {
      showTemporaryMessage(chatMessageContainer, "No chat selected.", "danger");
      return;
    }

    const messageText = chatMessageInput.value.trim();
    if (!messageText) {
      showTemporaryMessage(
        chatMessageContainer,
        "Message cannot be empty.",
        "warning"
      );
      return;
    }

    socket.emit("sendMessage", {
      chatId: activeChatId,
      senderId: currentUserId,
      senderRole: currentUserRole,
      text: messageText,
    });

    const optimisticMessage = {
      sender: currentUserId,
      text: messageText,
      timestamp: new Date(),
    };
    appendMessageToUI(optimisticMessage);
    chatMessageInput.value = "";

    loadChatList();
  }

  function setupSocketListeners() {
    if (!socket) {
      const token = getToken();
      const user = getUserData();
      if (!token || !user) {
        console.error(
          "Cannot establish socket connection: User not authenticated."
        );
        return;
      }

      socket = io(SOCKET_IO_URL, {
        query: {
          token: token,
          userId: user.id,
          userRole: user.role,
        },
      });

      socket.on("connect", () => {
        console.log("Connected to Socket.IO server:", socket.id);
      });

      socket.on("disconnect", () => {
        console.log("Disconnected from Socket.IO server.");
      });

      socket.on("connect_error", (err) => {
        console.error("Socket.IO connection error:", err.message);
        showTemporaryMessage(
          document.querySelector(".dashboard-content"),
          "Chat service unavailable. Please try again later.",
          "danger"
        );
      });

      socket.on("receiveMessage", (message) => {
        console.log("Received message:", message);

        if (
          message.chatRoom === activeChatId &&
          message.sender !== currentUserId
        ) {
          appendMessageToUI(message);
          fetchData(`/api/chat/${activeChatId}/mark-read`, "POST").then(() => {
            loadChatList();
          });
        } else if (message.chatRoom !== activeChatId) {
          loadChatList();
        }
      });

      socket.on("messageFailed", (data) => {
        console.error("Message failed to send:", data.error);
        showTemporaryMessage(
          chatMessageContainer,
          `Failed to send message: ${data.error}`,
          "danger"
        );
      });
    }
  }

  logoutBtn.addEventListener("click", function (event) {
    event.preventDefault();
    localStorage.removeItem("quickpickToken");
    localStorage.removeItem("quickpickUser");
    if (socket) {
      socket.disconnect();
    }
    window.location.href = `${window.origin}/Frontend/Register-login/register-login.html`;
  });

  sidebarLinks.forEach((link) => {
    link.addEventListener("click", function (event) {
      event.preventDefault();
      const targetId = this.dataset.target;
      if (targetId) {
        showSection(targetId);
      }
    });
  });

  //My cart fuctonality  
  getRecommendationBtn.addEventListener("click", getRecommendation);
  let cart = [];
  const CART_STORAGE_KEY = "quickpickCart";

  function saveCartToStorage() {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  }

  function loadCartFromStorage() {
    const saved = localStorage.getItem(CART_STORAGE_KEY);
    cart = saved ? JSON.parse(saved) : [];
  }

  function formatCurrency(num) {
    return parseFloat(num).toFixed(2);
  }

  
  function updateCartUI() {
    const cartItemsEl = document.getElementById("cart-items");
    const emptyCartMessage = document.getElementById("empty-cart-message");
    const cartCountEl = document.getElementById("cart-count");
    const cartTotalItemsEl = document.getElementById("cart-total-items");
    const cartTotalPriceEl = document.getElementById("cart-total-price");

    if (!cartItemsEl || !cartCountEl || !cartTotalItemsEl || !cartTotalPriceEl)
      return;

    cartItemsEl.innerHTML = "";
    if (cart.length === 0) {
      emptyCartMessage.classList.remove("d-none");
      cartCountEl.textContent = 0;
      cartTotalItemsEl.textContent = 0;
      cartTotalPriceEl.textContent = "0.00";
    } else {
      emptyCartMessage.classList.add("d-none");

      cart.forEach((item) => {
        cartItemsEl.insertAdjacentHTML(
          "beforeend",
          `<div class="col">
                    <div class="card shadow-sm p-3 h-100">
                        <div class="d-flex justify-content-between align-items-start">
                            <h6 class="mb-1">${item.name}</h6>
                            <button class="btn btn-sm btn-link text-danger p-0 btn-remove-item" data-product-id="${
                              item.id
                            }">&times;</button>
                        </div>
                        <p class="mb-1 small text-muted">₹${formatCurrency(
                          item.price
                        )} each</p>
                        <div class="d-flex align-items-center justify-content-between mt-auto">
                            <div class="input-group input-group-sm" style="width:110px;">
                                <button class="btn btn-outline-secondary btn-decrease-qty" data-product-id="${
                                  item.id
                                }" type="button">-</button>
                                <input type="text" class="form-control text-center cart-item-qty" data-product-id="${
                                  item.id
                                }" value="${item.qty}">
                                <button class="btn btn-outline-secondary btn-increase-qty" data-product-id="${
                                  item.id
                                }" type="button">+</button>
                            </div>
                            <div class="text-end fw-bold">₹${formatCurrency(
                              item.qty * item.price
                            )}</div>
                        </div>
                    </div>
                </div>`
        );
      });
    }

    const totalQty = cart.reduce((sum, i) => sum + i.qty, 0);
    const totalPrice = cart.reduce((sum, i) => sum + i.qty * i.price, 0);
    cartCountEl.textContent = totalQty;
    cartTotalItemsEl.textContent = totalQty;
    cartTotalPriceEl.textContent = formatCurrency(totalPrice);
  }

  function addToCartFromData(product) {
    const existing = cart.find((i) => i.id === product.id);
    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({
        id: product.id,
        name: product.name,
        price: Number(product.price),
        qty: 1,
      });
    }
    saveCartToStorage();
    updateCartUI();
  }

 
  loadCartFromStorage();
  updateCartUI();

  allProductsGrid.addEventListener("click", async function (event) {
    const target = event.target;
    const productId = target.dataset.productId;
    const sellerId = target.dataset.sellerId;
    const sellerName = target.dataset.sellerName;
    //
    if (target.classList.contains("btn-add-to-cart")) {
      const productCard = target.closest(".product-card");
      const productNameEl = productCard
        ? productCard.querySelector(".product-card-title")
        : null;
      const productPriceEl = productCard
        ? productCard.querySelector(".product-card-price")
        : null;

      const name = productNameEl
        ? productNameEl.textContent.trim()
        : `Product ${productId}`;
      let price = productPriceEl ? productPriceEl.textContent.trim() : "0";
      price = price.replace(/[^\d.-]+/g, "");
      if (!price) price = "0";

      addToCartFromData({ id: productId, name, price });
      showTemporaryMessage(
        document.querySelector(".dashboard-content"),
        "Product added to cart.",
        "success",
        2000
      );
    } else if (target.classList.contains("btn-chat-with-seller")) {
      if (!sellerId) {
        showTemporaryMessage(
          document.querySelector(".dashboard-content"),
          "Seller ID not found for chat.",
          "danger"
        );
        return;
      }
      const chatId = await initiateChat(sellerId, productId, sellerName);
      if (chatId) {
        showSection("messages-section");
        chatHeaderName.textContent = sellerName;
        chatHeaderProduct.textContent = productId
          ? `(Product: ${productId.substring(0, 8)}...)`
          : "";
        loadMessages(chatId);
      }
    }
    window.location.reload(); // for reload page after add to cart
       
  });

  document.getElementById("cart-items").addEventListener("click", function (e) {
    const target = e.target;
    const productId = target.dataset.productId;
    if (!productId) return;
    const idx = cart.findIndex((i) => i.id === productId);
    if (idx === -1) return;

    if (target.classList.contains("btn-increase-qty")) {
      cart[idx].qty += 1;
      saveCartToStorage();
      updateCartUI();
    } else if (target.classList.contains("btn-decrease-qty")) {
      cart[idx].qty = Math.max(1, cart[idx].qty - 1);
      saveCartToStorage();
      updateCartUI();
    } else if (target.classList.contains("btn-remove-item")) {
      cart.splice(idx, 1);
      saveCartToStorage();
      updateCartUI();
    }
  });

  document
    .getElementById("cart-items")
    .addEventListener("change", function (e) {
      const target = e.target;
      if (!target.classList.contains("cart-item-qty")) return;
      const productId = target.dataset.productId;
      const idx = cart.findIndex((i) => i.id === productId);
      if (idx === -1) return;
      let v = parseInt(target.value) || 1;
      cart[idx].qty = Math.max(1, v);
      saveCartToStorage();
      updateCartUI();
    });

 //My orders and checkout
  const checkoutBtn = document.getElementById("checkout-btn");
  const checkoutSection = document.getElementById("checkout-section");
  const cartSection = document.getElementById("cart-section");
  const backToCartBtn = document.getElementById("back-to-cart-btn");
  const placeOrderBtn = document.getElementById("place-order-btn");
 checkoutBtn.addEventListener("click", (e) => {
   e.preventDefault(); 

   if (!cart || cart.length === 0) {
     alert("Your cart is empty. Add items before checkout.");
     return; 
   }

   
   checkoutSection.classList.remove("d-none");
   cartSection.classList.add("d-none");
 });

  backToCartBtn.addEventListener("click", (e) => {
    e.preventDefault();
    checkoutSection.classList.add("d-none");
    cartSection.classList.remove("d-none");
  });
  placeOrderBtn.addEventListener("click", (e) => {
    e.preventDefault();

    const fullname = document.getElementById("fullname").value.trim();
    const mobile = document.getElementById("mobile").value.trim();
    const address = document.getElementById("address").value.trim();
    const pincode = document.getElementById("pincode").value.trim();
    const paymentMethod = document.querySelector(
      'input[name="payment"]:checked'
    )?.id;

    // Validation
    if (!fullname || !mobile || !address || !pincode) {
      alert("Please fill all address fields.");
      return;
    }
    if (mobile.length !== 10 || isNaN(mobile)) {
      alert("Enter a valid 10-digit mobile number.");
      return;
    }
    if (pincode.length !== 6 || isNaN(pincode)) {
      alert("Enter a valid 6-digit pincode.");
      return;
    }

    // Save order
    const orders = JSON.parse(localStorage.getItem("orders")) || [];
    orders.push({
      items: JSON.parse(localStorage.getItem("cartItems")) || [],
      fullname,
      mobile,
      address,
      pincode,
      paymentMethod,
      date: new Date().toLocaleString(),
    });
    localStorage.setItem("orders", JSON.stringify(orders));

    alert(`Order placed successfully!\nPayment Method: ${paymentMethod}`);

    localStorage.removeItem("cartItems");
    cart = [];
    updateCartUI();

      window.location.reload();
   
  });
    
function renderOrders() {
  const ordersListEl = document.getElementById("orders-list");
  ordersListEl.innerHTML = "";

  const orders = JSON.parse(localStorage.getItem("orders")) || [];

  if (orders.length === 0) {
    ordersListEl.innerHTML = `<p class="text-muted">You have no orders yet.</p>`;
    return;
  }

  // Show latest orders on top
  orders
    .slice()
    .reverse()
    .forEach((order, index) => {
      let itemsHtml = "";
      order.items.forEach((item) => {
        itemsHtml += `
                <div class="d-flex justify-content-between border-bottom pb-1 mb-1">
                    <span>${item.name} (x${item.qty})</span>
                    <span>₹${item.price * item.qty}</span>
                </div>`;
      });

      ordersListEl.insertAdjacentHTML(
        "beforeend",
        `<div class="card p-3 mb-3 shadow-sm">
                <h6>Order #${orders.length - index} - ${order.date}</h6>
                <div>${itemsHtml}</div>
                <p><strong>Address:</strong> ${order.fullname}, ${
          order.mobile
        }, ${order.address}, ${order.pincode}</p>
                <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
            </div>`
      );
    });
}

  document
    .querySelector(".sidebar-link[data-target='my-orders-section']")
    .addEventListener("click", () => {
      showSection("orders-section"); // your existing function to switch sections
      renderOrders(); // populate orders dynamically
    }); 

    

  chatList.addEventListener("click", function (event) {
    const target = event.target.closest(".chat-list-item");
    if (target) {
      const chatId = target.dataset.chatId;
      const otherParticipantName = target.dataset.otherParticipantName;
      const productName = target.dataset.productName;

      chatList
        .querySelectorAll(".chat-list-item")
        .forEach((item) => item.classList.remove("active"));
      target.classList.add("active");

      chatHeaderName.textContent = otherParticipantName;
      chatHeaderProduct.textContent = productName
        ? `(Product: ${productName})`
        : "";
      loadMessages(chatId);
    }
  });

  chatSendBtn.addEventListener("click", sendMessage);

  chatMessageInput.addEventListener("keypress", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      sendMessage();
    }
  });

  async function initializeBuyerDashboard() {
    if (checkBuyerStatus()) {
      setupSocketListeners();
      loadCartFromStorage(); // <- load from localStorage
      updateCartUI(); // <- update UI badge & cart section
      showSection("overview-section");
    }
  }

  initializeBuyerDashboard();
});
