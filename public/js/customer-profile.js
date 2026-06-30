// =============================================
// Query Cart — customer-profile.js (frontend)
// Part 1: Profile + Edit Profile
// Part 2: My Orders + Order Detail
// =============================================

let customerOrders = [];
let currentOrderFilter = 'all';
let currentOrderDetail = null;

document.addEventListener('DOMContentLoaded', () => {
    if (!isLoggedIn()) {
        window.location.href = 'login.html';
        return;
    }
    const user = getUser();
    if (user.role !== 'customer') {
        window.location.href = 'index.html';
        return;
    }

    setupTabs();
    loadSidebar();
    loadProfile();
    setupEditProfile();
    setupChangePassword();
    setupOrderFilters();
});

// =============================================
// TAB SWITCHING
// =============================================
function setupTabs() {
    document.querySelectorAll('.sidebar-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));

    document.getElementById(`tab-${tabName}`).classList.remove('hidden');

    const btn = document.querySelector(`.sidebar-btn[data-tab="${tabName}"]`);
    if (btn) btn.classList.add('active');

    if (tabName === 'orders') loadOrders();
    if (tabName === 'review' && typeof loadReviewProducts === 'function') loadReviewProducts();
}

// =============================================
// SIDEBAR
// =============================================
async function loadSidebar() {
    try {
        const data = await apiFetch('api/auth/me');
        const user = data.user;
        document.getElementById('sidebarUserName').textContent = `Hello ${user.name.split(' ')[0]}`;

        const statusEl = document.getElementById('sidebarUserStatus');
        statusEl.textContent = user.is_active ? 'Active' : 'Inactive';
        statusEl.className = `sidebar-user-status ${user.is_active ? '' : 'inactive'}`;
    } catch (err) {}
}

// =============================================
// PROFILE TAB
// =============================================
async function loadProfile() {
    const wrap = document.getElementById('profileWrap');

    try {
        const data = await apiFetch('api/auth/me');
        const user = data.user;

        let defaultAddress = 'Not set';
        try {
            const addrData = await apiFetch('api/orders/addresses');
            const def = addrData.addresses.find(a => a.is_default) || addrData.addresses[0];
            if (def) defaultAddress = `${def.street}, ${def.city}`;
        } catch (e) {}

        const initials = user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

        wrap.innerHTML = `
            <div class="profile-avatar-card">
                <div class="profile-avatar">${initials}</div>
                <div class="profile-name">${user.name}</div>
                <span class="profile-role-badge">Customer</span>
            </div>

            <div class="profile-card">
                <div class="profile-card-title">Account Information</div>
                <div class="profile-info-row">
                    <span class="profile-info-key">Email</span>
                    <span class="profile-info-val">${user.email}</span>
                </div>
                <div class="profile-info-row">
                    <span class="profile-info-key">Phone</span>
                    <span class="profile-info-val">${user.phone}</span>
                </div>
                <div class="profile-info-row">
                    <span class="profile-info-key">Account Status</span>
                    <span class="profile-info-val">${user.is_active ? 'Active' : 'Inactive'}</span>
                </div>
                <div class="profile-info-row">
                    <span class="profile-info-key">Default Address</span>
                    <span class="profile-info-val">${defaultAddress}</span>
                </div>
                <div class="profile-info-row">
                    <span class="profile-info-key">Member Since</span>
                    <span class="profile-info-val">${new Date(user.created_at).toLocaleDateString('en-BD', { year:'numeric', month:'long', day:'numeric' })}</span>
                </div>
            </div>
        `;

    } catch (err) {
        wrap.innerHTML = `<p style="color:var(--error);text-align:center;padding:2rem">Failed to load profile</p>`;
    }
}

// =============================================
// EDIT PROFILE TAB
// =============================================
function setupEditProfile() {
    apiFetch('api/auth/me').then(data => {
        const user = data.user;
        document.getElementById('editName').value = user.name;
        document.getElementById('editEmail').value = user.email;
        document.getElementById('editPhone').value = user.phone;
    }).catch(() => {});

    const form = document.getElementById('editProfileForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = form.querySelector('.submit-product-btn');
        const name = document.getElementById('editName').value.trim();
        const phone = document.getElementById('editPhone').value.trim();

        if (!name || !phone) {
            showToast('Name and phone are required', 'error');
            return;
        }

        btn.textContent = 'Saving...';
        btn.disabled = true;

        try {
            await apiFetch('api/auth/profile', {
                method: 'PUT',
                body: JSON.stringify({ name, phone })
            });

            const user = getUser();
            user.name = name;
            user.phone = phone;
            setUser(user, getToken());

            showToast('Profile updated!', 'success');
            loadSidebar();
            loadProfile();
            updateNav();
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            btn.textContent = 'Save Changes';
            btn.disabled = false;
        }
    });
}

// =============================================
// CHANGE PASSWORD
// =============================================
function setupChangePassword() {
    const form = document.getElementById('changePasswordForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = form.querySelector('.submit-product-btn');

        const current = document.getElementById('currentPassword').value;
        const newPass = document.getElementById('newPassword').value;
        const confirm = document.getElementById('confirmNewPassword').value;

        if (!current || !newPass || !confirm) {
            showToast('Please fill in all password fields', 'error');
            return;
        }

        if (newPass !== confirm) {
            showToast('New passwords do not match', 'error');
            return;
        }

        if (newPass.length < 6) {
            showToast('New password must be at least 6 characters', 'error');
            return;
        }

        btn.textContent = 'Updating...';
        btn.disabled = true;

        try {
            await apiFetch('api/auth/password', {
                method: 'PUT',
                body: JSON.stringify({ current_password: current, new_password: newPass })
            });

            showToast('Password updated!', 'success');
            form.reset();
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            btn.textContent = 'Update Password';
            btn.disabled = false;
        }
    });
}

// =============================================
// MY ORDERS TAB
// =============================================
function setupOrderFilters() {
    document.querySelectorAll('#ordersFilterRow .order-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#ordersFilterRow .order-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentOrderFilter = btn.dataset.status;
            renderOrders();
        });
    });
}

async function loadOrders() {
    const list = document.getElementById('customerOrdersList');
    list.innerHTML = '<div class="spinner"></div>';

    try {
        const data = await apiFetch('api/orders');
        customerOrders = data.orders;
        renderOrders();
    } catch (err) {
        list.innerHTML = '<p style="color:var(--error);text-align:center;padding:2rem">Failed to load orders</p>';
    }
}

function renderOrders() {
    const list = document.getElementById('customerOrdersList');

    const filtered = currentOrderFilter === 'all'
        ? customerOrders
        : customerOrders.filter(o => o.status === currentOrderFilter);

    if (filtered.length === 0) {
        list.innerHTML = `
            <div class="empty-dashboard">
                <div class="empty-dashboard-icon">📭</div>
                <p>No ${currentOrderFilter === 'all' ? '' : currentOrderFilter} orders found</p>
            </div>
        `;
        return;
    }

    list.innerHTML = '';
    filtered.forEach(order => {
        const card = document.createElement('div');
        card.className = 'customer-order-card';
        card.innerHTML = `
            <div class="customer-order-left">
                <div class="customer-order-id">Order #${order.order_id}</div>
                <div class="customer-order-meta">
                    ${new Date(order.ordered_at).toLocaleDateString('en-BD', { year:'numeric', month:'short', day:'numeric' })}
                    · ${order.item_count} item${order.item_count != 1 ? 's' : ''}
                    · <span class="status-pill status-${order.status}">${order.status}</span>
                </div>
            </div>
            <div class="customer-order-right">
                <span class="customer-order-total">${formatPrice(order.total_amount)}</span>
                <button class="order-details-btn" data-order-id="${order.order_id}">Details</button>
            </div>
        `;
        list.appendChild(card);
    });

    list.querySelectorAll('.order-details-btn').forEach(btn => {
        btn.addEventListener('click', () => openOrderDetail(btn.dataset.orderId));
    });
}

// =============================================
// ORDER DETAIL TAB
// =============================================
async function openOrderDetail(orderId) {
    switchTab('order-detail');

    const wrap = document.getElementById('orderDetailWrap');
    wrap.innerHTML = '<div class="spinner"></div>';

    try {
        const data = await apiFetch(`api/orders/${orderId}`);
        currentOrderDetail = data;
        renderOrderDetail(data);
    } catch (err) {
        wrap.innerHTML = '<p style="color:var(--error);text-align:center;padding:2rem">Failed to load order details</p>';
    }
}

function renderOrderDetail(data) {
    const wrap = document.getElementById('orderDetailWrap');
    const order = data.order;
    const items = data.items;

    let html = `<button class="back-link-btn" id="backToOrdersBtn">← Back to My Orders</button>`;

    // Product items card
    html += `<div class="order-detail-card">`;
    items.forEach(item => {
        const icon = getProductIcon(item.category_name);
        const thumb = item.image_url ? `<img src="${item.image_url}" alt="${item.name}" />` : icon;
        html += `
            <div class="order-detail-product">
                <div class="odp-thumb">${thumb}</div>
                <div class="odp-info">
                    <div class="odp-name">${item.name}</div>
                    <div class="odp-shop">🏪 ${item.shop_name}</div>
                </div>
                <div class="odp-qty">x${item.quantity}</div>
                <div class="odp-price">${formatPrice(item.unit_price * item.quantity)}</div>
            </div>
        `;
    });
    html += `</div>`;

    // Order meta card
    html += `
        <div class="order-detail-card">
            <div class="order-detail-meta-row">
                <span class="odm-key">Order ID</span>
                <span class="odm-val">#${order.order_id}</span>
            </div>
            <div class="order-detail-meta-row">
                <span class="odm-key">Placed On</span>
                <span class="odm-val">${new Date(order.ordered_at).toLocaleDateString('en-BD', { year:'numeric', month:'long', day:'numeric' })}</span>
            </div>
            <div class="order-detail-meta-row">
                <span class="odm-key">Delivery Address</span>
                <span class="odm-val">${order.street}, ${order.city}</span>
            </div>
            <div class="order-detail-meta-row">
                <span class="odm-key">Payment Method</span>
                <span class="odm-val">${formatPaymentMethodLabel(order.payment_method)}</span>
            </div>
            ${order.coupon_code ? `
            <div class="order-detail-meta-row">
                <span class="odm-key">Coupon Applied</span>
                <span class="odm-val">${order.coupon_code} (${order.discount_percent}% off)</span>
            </div>` : ''}
            <div class="order-detail-meta-row">
                <span class="odm-key">Total Amount</span>
                <span class="odm-val accent">${formatPrice(order.total_amount)}</span>
            </div>
            <div class="order-detail-meta-row">
                <span class="odm-key">Status</span>
                <span class="status-pill status-${order.status}">${order.status}</span>
            </div>
        </div>
    `;

    // Status action card
    if (order.status === 'pending' || order.status === 'processing') {
        html += `
            <div class="status-action-card processing">
                <div class="status-action-title">Need to cancel?</div>
                <div class="status-action-desc">You can cancel this order while it's still ${order.status}.</div>
                <div class="status-action-row">
                    <button class="status-action-btn secondary" id="cancelOrderBtn" data-order-id="${order.order_id}">Cancel Order</button>
                </div>
            </div>
        `;
    } else if (order.status === 'shipped') {
        html += `
            <div class="status-action-card shipped">
                <div class="status-action-title">Order Delivered?</div>
                <div class="status-action-desc">Once you receive your package, confirm delivery below.</div>
                <div class="status-action-row">
                    <button class="status-action-btn" id="confirmDeliveryBtn" data-order-id="${order.order_id}">Yes, I received it</button>
                </div>
            </div>
        `;
    } else if (order.status === 'delivered') {
        html += `
            <div class="status-action-card delivered">
                <div class="status-action-title">Order Delivered 🎉</div>
                <div class="status-action-desc">Loved your purchase? Share your thoughts with a review.</div>
                <div class="status-action-row">
                    <button class="review-link-btn" id="goToReviewBtn">Give a Review →</button>
                </div>
            </div>
        `;
    }

    wrap.innerHTML = html;

    // Bind actions
    document.getElementById('backToOrdersBtn').addEventListener('click', () => switchTab('orders'));

    const cancelBtn = document.getElementById('cancelOrderBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', async () => {
            if (!confirm('Are you sure you want to cancel this order?')) return;
            cancelBtn.textContent = 'Cancelling...';
            cancelBtn.disabled = true;
            try {
                await apiFetch(`api/orders/${order.order_id}/cancel`, { method: 'PATCH' });
                showToast('Order cancelled', 'success');
                openOrderDetail(order.order_id);
            } catch (err) {
                showToast(err.message, 'error');
                cancelBtn.textContent = 'Cancel Order';
                cancelBtn.disabled = false;
            }
        });
    }

    const confirmBtn = document.getElementById('confirmDeliveryBtn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
            confirmBtn.textContent = 'Confirming...';
            confirmBtn.disabled = true;
            try {
                await apiFetch(`api/orders/${order.order_id}/confirm-delivery`, { method: 'PATCH' });
                showToast('Order marked as delivered!', 'success');
                openOrderDetail(order.order_id);
            } catch (err) {
                showToast(err.message, 'error');
                confirmBtn.textContent = 'Yes, I received it';
                confirmBtn.disabled = false;
            }
        });
    }

    const reviewBtn = document.getElementById('goToReviewBtn');
    if (reviewBtn) {
        reviewBtn.addEventListener('click', () => switchTab('review'));
    }
}

function formatPaymentMethodLabel(method) {
    const map = {
        'mobile_banking': '📱 Mobile Banking',
        'card': '💳 Card',
        'cash': '💵 Cash on Delivery'
    };
    return map[method] || method;
}

// =============================================
// REVIEW TAB
// =============================================
async function loadReviewProducts() {
    const list = document.getElementById('reviewProductsList');
    list.innerHTML = '<div class="spinner"></div>';
 
    try {
        const data = await apiFetch('api/products/reviewable');
        const products = data.products;
 
        if (products.length === 0) {
            list.innerHTML = `
                <div class="empty-dashboard">
                    <div class="empty-dashboard-icon">⭐</div>
                    <p>No delivered products to review yet.</p>
                </div>
            `;
            return;
        }
 
        list.innerHTML = '';
 
        products.forEach(p => {
            const icon = getProductIcon(p.category_name);
            const thumb = p.image_url ? `<img src="${p.image_url}" alt="${p.name}" />` : icon;
 
            const card = document.createElement('div');
            card.className = 'review-product-card';
 
            if (p.already_reviewed) {
                card.innerHTML = `
                    <div class="review-product-top">
                        <div class="rp-thumb">${thumb}</div>
                        <div class="rp-info">
                            <div class="rp-name">${p.name}</div>
                            <div class="rp-shop">🏪 ${p.shop_name}</div>
                        </div>
                    </div>
                    <span class="already-reviewed-badge">✓ Already reviewed</span>
                `;
            } else {
                card.innerHTML = `
                    <div class="review-product-top">
                        <div class="rp-thumb">${thumb}</div>
                        <div class="rp-info">
                            <div class="rp-name">${p.name}</div>
                            <div class="rp-shop">🏪 ${p.shop_name}</div>
                        </div>
                    </div>
                    <div class="star-picker" data-product-id="${p.product_id}">
                        <span class="star-opt" data-val="1">★</span>
                        <span class="star-opt" data-val="2">★</span>
                        <span class="star-opt" data-val="3">★</span>
                        <span class="star-opt" data-val="4">★</span>
                        <span class="star-opt" data-val="5">★</span>
                    </div>
                    <textarea class="review-textarea" placeholder="Share your experience with this product (optional)..."></textarea>
                    <button class="submit-review-btn" data-product-id="${p.product_id}">Submit Review</button>
                `;
            }
 
            list.appendChild(card);
        });
 
        setupReviewInteractions();
 
    } catch (err) {
        list.innerHTML = '<p style="color:var(--error);text-align:center;padding:2rem">Failed to load products</p>';
    }
}
 
function setupReviewInteractions() {
    // Star picker
    document.querySelectorAll('.star-picker').forEach(picker => {
        const stars = picker.querySelectorAll('.star-opt');
        stars.forEach(star => {
            star.addEventListener('click', () => {
                const val = parseInt(star.dataset.val);
                picker.dataset.selected = val;
                stars.forEach(s => {
                    s.classList.toggle('active', parseInt(s.dataset.val) <= val);
                });
            });
        });
    });
 
    // Submit review
    document.querySelectorAll('.submit-review-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const card = btn.closest('.review-product-card');
            const picker = card.querySelector('.star-picker');
            const textarea = card.querySelector('.review-textarea');
            const rating = parseInt(picker.dataset.selected || 0);
            const comment = textarea.value.trim();
            const product_id = btn.dataset.productId;
 
            if (!rating) {
                showToast('Please select a star rating', 'error');
                return;
            }
 
            btn.textContent = 'Submitting...';
            btn.disabled = true;
 
            try {
                await apiFetch('api/products/review', {
                    method: 'POST',
                    body: JSON.stringify({ product_id, rating, comment })
                });
                showToast('Review submitted!', 'success');
                loadReviewProducts();
            } catch (err) {
                showToast(err.message, 'error');
                btn.textContent = 'Submit Review';
                btn.disabled = false;
            }
        });
    });
}