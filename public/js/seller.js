// =============================================
// Query Cart — seller.js (frontend)
// =============================================

let shopData = null;
let hasShop = false;
let sellerProducts = [];
let sellerOrders = [];
let allCategories = [];
let currentOrderFilter = 'all';
let isEditMode = false;

document.addEventListener('DOMContentLoaded', () => {
    if (!isLoggedIn()) {
        window.location.href = 'login.html';
        return;
    }
    const user = getUser();
    if (user.role !== 'seller') {
        window.location.href = 'index.html';
        return;
    }

    document.getElementById('overviewSellerName').textContent = user.name.split(' ')[0];

    setupTabs();
    loadShopData();
    loadCategories();
    setupProductForm();
    setupOrderFilters();
    setupSettings();
    setupCreateShopForm();
    setupImageUpload();
    setupCategoryDropdown();
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
    document.querySelector(`.sidebar-btn[data-tab="${tabName}"]`).classList.add('active');

    // Block product/order/add-product tabs if no shop yet
    if (!hasShop && ['products', 'add-product', 'orders'].includes(tabName)) {
        renderShopRequiredPrompt(tabName);
        return;
    }

    if (tabName === 'products') loadSellerProducts();
    if (tabName === 'orders')   loadSellerOrders();
    if (tabName === 'overview') loadOverview();
}

function renderShopRequiredPrompt(tabName) {
    const promptHtml = `
        <div class="empty-dashboard">
            <div class="empty-dashboard-icon">🏪</div>
            <p>Create your shop first to manage products and orders.</p>
            <button class="text-btn" onclick="switchTab('settings')">Go to Shop Settings</button>
        </div>
    `;

    if (tabName === 'products') {
        document.getElementById('sellerProductsList').innerHTML = promptHtml;
        document.querySelector('#tab-products .products-toolbar')?.classList.add('hidden');
    } else if (tabName === 'orders') {
        document.getElementById('sellerOrdersList').innerHTML = promptHtml;
        document.querySelector('#tab-orders .orders-filter-row')?.classList.add('hidden');
    } else if (tabName === 'add-product') {
        document.querySelector('.add-product-form-wrap').innerHTML = promptHtml;
    }
}

// =============================================
// LOAD SHOP DATA
// =============================================
async function loadShopData() {
    try {
        const data = await apiFetch('/seller/shop/status');
        hasShop = data.has_shop;
        shopData = data.shop;

        if (!hasShop) {
            document.getElementById('sidebarShopName').textContent = 'No shop yet';
            document.getElementById('sidebarShopRating').textContent = '⭐ —';

            const statusEl = document.getElementById('sidebarShopStatus');
            statusEl.textContent = 'Setup needed';
            statusEl.className = 'sidebar-shop-status inactive';

            document.getElementById('createShopWrap').classList.remove('hidden');
            document.getElementById('shopSettingsWrap').classList.add('hidden');

            showShopPromptOnOverview();
            return;
        }

        // Shop exists
        document.getElementById('sidebarShopName').textContent = shopData.shop_name;
        document.getElementById('sidebarShopRating').textContent = `⭐ ${shopData.rating || '0.00'}`;

        const statusEl = document.getElementById('sidebarShopStatus');
        statusEl.textContent = shopData.is_active ? 'Active' : 'Inactive';
        statusEl.className = `sidebar-shop-status ${shopData.is_active ? 'active' : 'inactive'}`;

        document.getElementById('createShopWrap').classList.add('hidden');
        document.getElementById('shopSettingsWrap').classList.remove('hidden');

        document.getElementById('settingsShopName').value = shopData.shop_name;
        document.getElementById('settingsShopDesc').value = shopData.description || '';
        document.getElementById('settingsShopActive').value = shopData.is_active.toString();

        loadOverview();
    } catch (err) {
        showToast('Failed to load shop data', 'error');
    }
}

function showShopPromptOnOverview() {
    const promptHtml = `
        <div class="empty-dashboard">
            <div class="empty-dashboard-icon">🏪</div>
            <p>You need to create your shop before you can start selling.</p>
            <button class="text-btn" onclick="switchTab('settings')">Create Shop</button>
        </div>
    `;

    document.getElementById('statProducts').textContent = '—';
    document.getElementById('statActive').textContent = '—';
    document.getElementById('statOrders').textContent = '—';
    document.getElementById('statRevenue').textContent = '—';
    document.getElementById('recentOrdersList').innerHTML = promptHtml;
    document.getElementById('lowStockList').innerHTML = '';
}

// =============================================
// CREATE SHOP
// =============================================
function setupCreateShopForm() {
    const form = document.getElementById('createShopForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = form.querySelector('.submit-product-btn');
        const name = document.getElementById('newShopName').value.trim();
        const desc = document.getElementById('newShopDesc').value.trim();

        if (!name) {
            showToast('Shop name is required', 'error');
            return;
        }

        btn.textContent = 'Creating...';
        btn.disabled = true;

        try {
            await apiFetch('/seller/shop', {
                method: 'POST',
                body: JSON.stringify({ shop_name: name, description: desc })
            });
            showToast('Shop created successfully!', 'success');
            setTimeout(() => location.reload(), 800);
        } catch (err) {
            showToast(err.message, 'error');
            btn.textContent = 'Create Shop';
            btn.disabled = false;
        }
    });
}

// =============================================
// OVERVIEW
// =============================================
async function loadOverview() {
    try {
        const data = await apiFetch('/seller/overview');

        document.getElementById('statProducts').textContent = data.total_products;
        document.getElementById('statActive').textContent = data.active_products;
        document.getElementById('statOrders').textContent = data.total_orders;
        document.getElementById('statRevenue').textContent = formatPrice(data.total_revenue || 0);

        renderRecentOrders(data.recent_orders || []);
        renderLowStock(data.low_stock || []);
    } catch (err) {
        console.error(err);
    }
}

function renderRecentOrders(orders) {
    const el = document.getElementById('recentOrdersList');
    if (orders.length === 0) {
        el.innerHTML = '<div class="empty-dashboard"><div class="empty-dashboard-icon">📭</div><p>No orders yet</p></div>';
        return;
    }
    el.innerHTML = orders.slice(0, 5).map(o => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:0.7rem 0;border-bottom:1px solid rgba(255,245,240,0.7);font-size:0.86rem">
            <div>
                <span style="font-weight:700;color:var(--text)">Order #${o.order_id}</span>
                <span style="color:var(--text-muted);margin-left:0.5rem">${new Date(o.ordered_at).toLocaleDateString()}</span>
            </div>
            <div style="display:flex;gap:0.8rem;align-items:center">
                <span class="status-pill status-${o.status}">${o.status}</span>
                <span style="font-family:var(--font-display);font-weight:800;color:var(--accent)">${formatPrice(o.total_amount)}</span>
            </div>
        </div>
    `).join('');
}

function renderLowStock(products) {
    const el = document.getElementById('lowStockList');
    if (products.length === 0) {
        el.innerHTML = '<div class="empty-dashboard"><div class="empty-dashboard-icon">✅</div><p>All products have sufficient stock</p></div>';
        return;
    }
    el.innerHTML = products.map(p => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:0.6rem 0;border-bottom:1px solid rgba(255,245,240,0.7);font-size:0.86rem">
            <span style="font-weight:600;color:var(--text)">${p.name}</span>
            <span style="font-weight:700;color:var(--error)">Only ${p.stock} left</span>
        </div>
    `).join('');
}

// =============================================
// SELLER PRODUCTS
// =============================================
async function loadSellerProducts() {
    const list = document.getElementById('sellerProductsList');
    list.innerHTML = '<div class="spinner"></div>';

    try {
        const data = await apiFetch('/seller/products');
        sellerProducts = data.products;
        renderSellerProducts(sellerProducts);
    } catch (err) {
        list.innerHTML = '<p style="color:var(--error);text-align:center;padding:2rem">Failed to load products</p>';
    }
}

function renderSellerProducts(products) {
    const list = document.getElementById('sellerProductsList');

    const search = document.getElementById('productSearch').value.toLowerCase();
    const filter = document.getElementById('productFilter').value;

    let filtered = products.filter(p => {
        const matchSearch = p.name.toLowerCase().includes(search);
        if (filter === 'active')    return matchSearch && p.is_available;
        if (filter === 'inactive')  return matchSearch && !p.is_available;
        if (filter === 'low_stock') return matchSearch && p.stock < 5;
        return matchSearch;
    });

    if (filtered.length === 0) {
        list.innerHTML = `
            <div class="empty-dashboard">
                <div class="empty-dashboard-icon">📦</div>
                <p>No products found. <button class="text-btn" onclick="switchTab('add-product')">Add your first product</button></p>
            </div>
        `;
        return;
    }

    list.innerHTML = '';
    filtered.forEach(p => {
        const icon = getProductIcon(p.category_name);
        const thumb = p.image_url ? `<img src="${p.image_url}" alt="${p.name}" />` : icon;
        const isLow = p.stock < 5;

        const div = document.createElement('div');
        div.className = 'seller-product-item';
        div.innerHTML = `
            <div class="seller-product-thumb">${thumb}</div>
            <div class="seller-product-info">
                <div class="seller-product-name">${p.name}</div>
                <div class="seller-product-meta">
                    <span class="seller-product-price">${formatPrice(p.price)}</span>
                    <span class="seller-product-stock ${isLow ? 'low' : ''}">Stock: ${p.stock}</span>
                    <span style="font-size:0.74rem;color:var(--text-muted)">${p.category_name}</span>
                </div>
            </div>
            <label class="availability-toggle" title="${p.is_available ? 'Click to deactivate' : 'Click to activate'}">
                <label class="toggle-switch">
                    <input type="checkbox" ${p.is_available ? 'checked' : ''} data-product-id="${p.product_id}" class="availability-checkbox" />
                    <span class="toggle-slider"></span>
                </label>
                <span style="font-size:0.78rem;color:var(--text-muted)">${p.is_available ? 'Active' : 'Inactive'}</span>
            </label>
            <div class="seller-product-actions">
                <button class="edit-btn" data-product-id="${p.product_id}">✏️ Edit</button>
                <button class="delete-btn" data-product-id="${p.product_id}">🗑 Delete</button>
            </div>
        `;
        list.appendChild(div);
    });

    list.querySelectorAll('.availability-checkbox').forEach(cb => {
        cb.addEventListener('change', async () => {
            try {
                await apiFetch(`/seller/products/${cb.dataset.productId}/toggle`, { method: 'PATCH' });
                showToast('Product updated', 'success');
                loadSellerProducts();
            } catch (err) {
                showToast(err.message, 'error');
                cb.checked = !cb.checked;
            }
        });
    });

    list.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => openEditProduct(btn.dataset.productId));
    });

    list.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('Delete this product? This cannot be undone.')) return;
            try {
                await apiFetch(`/seller/products/${btn.dataset.productId}`, { method: 'DELETE' });
                showToast('Product deleted', 'success');
                loadSellerProducts();
                loadOverview();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    });

    document.getElementById('productSearch').oninput = () => renderSellerProducts(sellerProducts);
    document.getElementById('productFilter').onchange = () => renderSellerProducts(sellerProducts);
}

// =============================================
// ADD / EDIT PRODUCT FORM
// =============================================
async function loadCategories() {
    try {
        const data = await apiFetch('/products/categories');
        allCategories = data.categories;
        const select = document.getElementById('productCategory');
        const currentVal = select.value;
        select.innerHTML = '<option value="">Select category</option>';
        allCategories.forEach(c => {
            select.innerHTML += `<option value="${c.category_id}">${c.category_name}</option>`;
        });
        select.innerHTML += `<option value="__new__">+ Add new category</option>`;
        if (currentVal && currentVal !== '__new__') select.value = currentVal;
    } catch (err) {}
}

// --- NEW CATEGORY DROPDOWN ---
function setupCategoryDropdown() {
    const select = document.getElementById('productCategory');
    const wrap = document.getElementById('newCategoryWrap');
    const input = document.getElementById('newCategoryName');

    if (!select) return;

    select.addEventListener('change', () => {
        if (select.value === '__new__') {
            wrap.classList.remove('hidden');
            input.focus();
        } else {
            wrap.classList.add('hidden');
            input.value = '';
        }
    });
}

function setupImageUpload() {
    const area = document.getElementById('imageUploadArea');
    const input = document.getElementById('productImage');
    const preview = document.getElementById('imagePreview');
    const previewImg = document.getElementById('previewImg');
    const removeBtn = document.getElementById('removeImage');

    if (!area) return;

    area.addEventListener('click', () => input.click());

    input.addEventListener('change', () => {
        const file = input.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            showToast('Image must be under 5MB', 'error');
            return;
        }
        const url = URL.createObjectURL(file);
        previewImg.src = url;
        area.classList.add('hidden');
        preview.classList.remove('hidden');
    });

    removeBtn.addEventListener('click', () => {
        input.value = '';
        previewImg.src = '';
        preview.classList.add('hidden');
        area.classList.remove('hidden');
    });
}

function setupProductForm() {
    const form = document.getElementById('addProductForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitProductForm();
    });
}

async function submitProductForm() {
    const btn = document.getElementById('submitProductBtn');
    const name        = document.getElementById('productName').value.trim();
    const category    = document.getElementById('productCategory').value;
    const price       = document.getElementById('productPrice').value;
    const stock       = document.getElementById('productStock').value;
    const description = document.getElementById('productDescription').value.trim();
    const available   = document.getElementById('productAvailable').value;
    const imageFile   = document.getElementById('productImage').files[0];
    const editId      = document.getElementById('editProductId').value;

    if (!name || !category || !price || !stock) {
        showToast('Please fill in all required fields', 'error');
        return;
    }

    // Handle new category creation
    let categoryId = category;

    if (category === '__new__') {
        const newCatName = document.getElementById('newCategoryName').value.trim();
        if (!newCatName) {
            showToast('Please enter a category name', 'error');
            return;
        }

        try {
            const catData = await apiFetch('/products/categories', {
                method: 'POST',
                body: JSON.stringify({ category_name: newCatName })
            });
            categoryId = catData.category.category_id;
            await loadCategories();
        } catch (err) {
            showToast(err.message, 'error');
            return;
        }
    }

    btn.textContent = isEditMode ? 'Saving...' : 'Adding...';
    btn.disabled = true;

    try {
        const formData = new FormData();
        formData.append('name', name);
        formData.append('category_id', categoryId);
        formData.append('price', price);
        formData.append('stock', stock);
        formData.append('description', description);
        formData.append('is_available', available);
        if (imageFile) formData.append('image', imageFile);

        const token = getToken();
        const url = isEditMode
            ? `http://localhost:5030/api/seller/products/${editId}`
            : 'http://localhost:5030/api/seller/products';

        const res = await fetch(url, {
            method: isEditMode ? 'PUT' : 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');

        showToast(isEditMode ? 'Product updated!' : 'Product added!', 'success');
        resetProductForm();
        switchTab('products');
        loadOverview();

    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.textContent = isEditMode ? 'Save Changes' : 'Add Product';
        btn.disabled = false;
    }
}

function openEditProduct(productId) {
    const product = sellerProducts.find(p => p.product_id == productId);
    if (!product) return;

    isEditMode = true;
    document.getElementById('editProductId').value = product.product_id;
    document.getElementById('productName').value = product.name;
    document.getElementById('productCategory').value = product.category_id;
    document.getElementById('productPrice').value = product.price;
    document.getElementById('productStock').value = product.stock;
    document.getElementById('productDescription').value = product.description || '';
    document.getElementById('productAvailable').value = product.is_available.toString();
    document.getElementById('addProductEyebrow').textContent = 'Editing Product';
    document.getElementById('addProductTitle').textContent = product.name;
    document.getElementById('submitProductBtn').textContent = 'Save Changes';
    document.getElementById('cancelEditBtn').style.display = 'inline-block';

    document.getElementById('newCategoryWrap').classList.add('hidden');
    document.getElementById('newCategoryName').value = '';

    if (product.image_url) {
        document.getElementById('previewImg').src = product.image_url;
        document.getElementById('imageUploadArea').classList.add('hidden');
        document.getElementById('imagePreview').classList.remove('hidden');
    }

    switchTab('add-product');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEdit() {
    resetProductForm();
}

function resetProductForm() {
    isEditMode = false;
    document.getElementById('editProductId').value = '';
    document.getElementById('addProductForm').reset();
    document.getElementById('addProductEyebrow').textContent = 'New Listing';
    document.getElementById('addProductTitle').textContent = 'Add Product';
    document.getElementById('submitProductBtn').textContent = 'Add Product';
    document.getElementById('cancelEditBtn').style.display = 'none';
    document.getElementById('imagePreview').classList.add('hidden');
    document.getElementById('imageUploadArea').classList.remove('hidden');
    document.getElementById('previewImg').src = '';
    document.getElementById('newCategoryWrap').classList.add('hidden');
    document.getElementById('newCategoryName').value = '';
}

// =============================================
// SELLER ORDERS
// =============================================
function setupOrderFilters() {
    document.querySelectorAll('.order-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.order-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentOrderFilter = btn.dataset.status;
            renderSellerOrders();
        });
    });
}

async function loadSellerOrders() {
    const list = document.getElementById('sellerOrdersList');
    list.innerHTML = '<div class="spinner"></div>';

    try {
        const data = await apiFetch('/seller/orders');
        sellerOrders = data.orders;
        renderSellerOrders();
    } catch (err) {
        list.innerHTML = '<p style="color:var(--error);text-align:center;padding:2rem">Failed to load orders</p>';
    }
}

function renderSellerOrders() {
    const list = document.getElementById('sellerOrdersList');

    const filtered = currentOrderFilter === 'all'
        ? sellerOrders
        : sellerOrders.filter(o => o.status === currentOrderFilter);

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
        card.className = 'seller-order-card';
        card.innerHTML = `
            <div class="seller-order-top">
                <div>
                    <div class="seller-order-id">Order #${order.order_id}</div>
                    <div class="seller-order-date">${new Date(order.ordered_at).toLocaleDateString('en-BD', { year:'numeric', month:'short', day:'numeric' })}</div>
                </div>
                <select class="order-status-select" data-order-id="${order.order_id}"
                    ${(order.status === 'delivered' || order.status === 'cancelled') ? 'disabled' : ''}>
                    
                    ${order.status === 'delivered' ? '<option value="delivered" selected>Delivered</option>' : ''}
                    
                    <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
                    
                    <option value="processing" ${order.status === 'processing' ? 'selected' : ''}>Processing</option>
                    
                    <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>Shipped</option>
                    
                    <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                    
                </select>
            </div>
            <div class="seller-order-items">
                ${order.items.map(item => {
                    const icon = getProductIcon(item.category_name);
                    const thumb = item.image_url ? `<img src="${item.image_url}" alt="${item.name}" />` : icon;
                    return `
                        <div class="seller-order-item">
                            <div class="order-item-icon">${thumb}</div>
                            <div class="order-item-name">${item.name}</div>
                            <div class="order-item-qty">x${item.quantity}</div>
                            <div class="order-item-price">${formatPrice(item.unit_price * item.quantity)}</div>
                        </div>
                    `;
                }).join('')}
            </div>
            <div class="seller-order-footer">
                <span class="seller-order-customer">👤 ${order.customer_name} · ${order.city}</span>
                <span class="seller-order-total">${formatPrice(order.total_amount)}</span>
            </div>
        `;
        list.appendChild(card);
    });

    list.querySelectorAll('.order-status-select').forEach(select => {
        select.addEventListener('change', async () => {
            try {
                await apiFetch(`/seller/orders/${select.dataset.orderId}/status`, {
                    method: 'PATCH',
                    body: JSON.stringify({ status: select.value })
                });
                showToast('Order status updated', 'success');
                const order = sellerOrders.find(o => o.order_id == select.dataset.orderId);
                if (order) order.status = select.value;
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    });
}

// =============================================
// SHOP SETTINGS
// =============================================
function setupSettings() {
    loadAccountInfo();

    const form = document.getElementById('shopSettingsForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('.submit-product-btn');
        btn.textContent = 'Saving...';
        btn.disabled = true;

        try {
            await apiFetch('/seller/shop', {
                method: 'PUT',
                body: JSON.stringify({
                    shop_name: document.getElementById('settingsShopName').value.trim(),
                    description: document.getElementById('settingsShopDesc').value.trim(),
                    is_active: document.getElementById('settingsShopActive').value === 'true'
                })
            });
            showToast('Shop settings saved!', 'success');
            loadShopData();
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            btn.textContent = 'Save Changes';
            btn.disabled = false;
        }
    });
}

async function loadAccountInfo() {
    try {
        const data = await apiFetch('/auth/me');
        const user = data.user;
        const el = document.getElementById('accountInfoList');
        if (!el) return;
        el.innerHTML = `
            <div class="account-info-row">
                <span class="account-info-key">Name</span>
                <span class="account-info-val">${user.name}</span>
            </div>
            <div class="account-info-row">
                <span class="account-info-key">Email</span>
                <span class="account-info-val">${user.email}</span>
            </div>
            <div class="account-info-row">
                <span class="account-info-key">Phone</span>
                <span class="account-info-val">${user.phone}</span>
            </div>
            <div class="account-info-row">
                <span class="account-info-key">Role</span>
                <span class="account-info-val">Seller</span>
            </div>
            <div class="account-info-row">
                <span class="account-info-key">Member Since</span>
                <span class="account-info-val">${new Date(user.created_at).toLocaleDateString('en-BD', {year:'numeric',month:'long'})}</span>
            </div>
        `;
    } catch (err) {}
}