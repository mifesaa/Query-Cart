// =============================================
// Query Cart — cart.js (frontend)
// =============================================

let cartItems = [];
let wishlistItems = [];
let cartTotal = 0;
let discountPercent = 0;
let appliedCoupon = null;

document.addEventListener('DOMContentLoaded', () => {
    if (!isLoggedIn()) {
        window.location.href = 'login.html';
        return;
    }
    const user = getUser();
    if (user.role === 'seller') {
        window.location.href = 'seller-dashboard.html';
        return;
    }

    loadCart();
    loadWishlist();
    setupCoupon();
    setupCheckout();
});

// --- LOAD CART ---
async function loadCart() {
    const content = document.getElementById('cartContent');
    const clearBtn = document.getElementById('clearCartBtn');

    try {
        const data = await apiFetch('api/cart');
        cartItems = data.items;
        cartTotal = parseFloat(data.total);

        updateSummary();

        if (cartItems.length === 0) {
            clearBtn.classList.add('hidden');
            content.innerHTML = `
                <div class="cart-empty">
                    <div class="cart-empty-icon">🛒</div>
                    <h3>Your cart is empty</h3>
                    <p>Browse our products and add something you like</p>
                    <a href="products.html" class="cta-primary" style="display:inline-block">Browse Products</a>
                </div>
            `;
            document.getElementById('checkoutBtn').disabled = true;
            return;
        }

        clearBtn.classList.remove('hidden');
        document.getElementById('checkoutBtn').disabled = false;
        renderCartItems();

    } catch (err) {
        content.innerHTML = `<p style="color:var(--error);text-align:center;padding:2rem">Failed to load cart</p>`;
    }
}

// --- RENDER CART ITEMS ---
function renderCartItems() {
    const content = document.getElementById('cartContent');
    const list = document.createElement('div');
    list.className = 'cart-items-list';

    cartItems.forEach(item => {
        const icon = getProductIcon(item.category_name);
        const thumb = item.image_url
            ? `<img src="${item.image_url}" alt="${item.name}" />`
            : icon;

        const div = document.createElement('div');
        div.className = 'cart-item';
        div.dataset.cartId = item.cart_id;
        div.innerHTML = `
            <div class="cart-item-thumb">${thumb}</div>
            <div class="cart-item-info">
                <div class="cart-item-name" onclick="window.location.href='product-detail.html?id=${item.product_id}'">${item.name}</div>
                <div class="cart-item-shop">🏪 ${item.shop_name}</div>
                <div class="cart-item-price">${formatPrice(item.price)} each</div>
            </div>
            <div class="cart-item-controls">
                <div class="cart-item-subtotal">${formatPrice(item.price * item.quantity)}</div>
                <div class="cart-qty-control">
                    <button class="cart-qty-btn" data-action="minus" data-cart-id="${item.cart_id}" data-qty="${item.quantity}" data-stock="${item.stock}">−</button>
                    <span class="cart-qty-num">${item.quantity}</span>
                    <button class="cart-qty-btn" data-action="plus" data-cart-id="${item.cart_id}" data-qty="${item.quantity}" data-stock="${item.stock}">+</button>
                </div>
                <button class="cart-item-remove" data-cart-id="${item.cart_id}">✕ Remove</button>
            </div>
        `;
        list.appendChild(div);
    });

    content.innerHTML = '';
    content.appendChild(list);

    // Qty buttons
    content.querySelectorAll('.cart-qty-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const cartId = btn.dataset.cartId;
            let qty = parseInt(btn.dataset.qty);
            const stock = parseInt(btn.dataset.stock);

            if (btn.dataset.action === 'minus') qty = Math.max(1, qty - 1);
            else qty = Math.min(stock, qty + 1);

            await updateQty(cartId, qty);
        });
    });

    // Remove buttons
    content.querySelectorAll('.cart-item-remove').forEach(btn => {
        btn.addEventListener('click', async () => {
            await removeItem(btn.dataset.cartId);
        });
    });

    // Clear all
    document.getElementById('clearCartBtn').addEventListener('click', async () => {
        if (!confirm('Clear your entire cart?')) return;
        await apiFetch('api/cart', { method: 'DELETE' });
        loadCart();
        showToast('Cart cleared');
    });
}

// --- UPDATE QTY ---
async function updateQty(cartId, qty) {
    try {
        await apiFetch(`api/cart/${cartId}`, {
            method: 'PATCH',
            body: JSON.stringify({ quantity: qty })
        });
        loadCart();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// --- REMOVE ITEM ---
async function removeItem(cartId) {
    try {
        await apiFetch(`api/cart/${cartId}`, { method: 'DELETE' });
        showToast('Item removed');
        loadCart();
        updateCartCount();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// --- LOAD WISHLIST ---
async function loadWishlist() {
    const content = document.getElementById('wishlistContent');

    try {
        const data = await apiFetch('api/cart/wishlist');
        wishlistItems = data.items;

        if (wishlistItems.length === 0) {
            content.innerHTML = '<p class="wishlist-empty">Your wishlist is empty.</p>';
            return;
        }

        const list = document.createElement('div');
        list.className = 'wishlist-items-list';

        wishlistItems.forEach(item => {
            const icon = getProductIcon(item.category_name);
            const thumb = item.image_url
                ? `<img src="${item.image_url}" alt="${item.name}" />`
                : icon;

            const div = document.createElement('div');
            div.className = 'wishlist-item';
            div.innerHTML = `
                <div class="wishlist-thumb">${thumb}</div>
                <div class="wishlist-body">
                    <div class="wishlist-name" title="${item.name}">${item.name}</div>
                    <div class="wishlist-price">${formatPrice(item.price)}</div>
                    <div class="wishlist-actions">
                        <button class="wishlist-move-btn" data-product-id="${item.product_id}" data-wishlist-id="${item.wishlist_id}">+ Cart</button>
                        <button class="wishlist-remove-btn" data-wishlist-id="${item.wishlist_id}">✕</button>
                    </div>
                </div>
            `;
            list.appendChild(div);
        });

        content.innerHTML = '';
        content.appendChild(list);

        // Move to cart
        content.querySelectorAll('.wishlist-move-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                try {
                    await apiFetch('api/cart', {
                        method: 'POST',
                        body: JSON.stringify({ product_id: btn.dataset.productId, quantity: 1 })
                    });
                    await apiFetch(`api/cart/wishlist/${btn.dataset.wishlistId}`, { method: 'DELETE' });
                    showToast('Moved to cart!', 'success');
                    loadCart();
                    loadWishlist();
                    updateCartCount();
                } catch (err) {
                    showToast(err.message, 'error');
                }
            });
        });

        // Remove from wishlist
        content.querySelectorAll('.wishlist-remove-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                try {
                    await apiFetch(`api/cart/wishlist/${btn.dataset.wishlistId}`, { method: 'DELETE' });
                    showToast('Removed from wishlist');
                    loadWishlist();
                } catch (err) {
                    showToast(err.message, 'error');
                }
            });
        });

    } catch (err) {
        content.innerHTML = '<p class="wishlist-empty">Could not load wishlist.</p>';
    }
}

// --- COUPON ---
function setupCoupon() {
    document.getElementById('applyCoupon').addEventListener('click', async () => {
        const code = document.getElementById('couponInput').value.trim().toUpperCase();
        const resultEl = document.getElementById('couponResult');

        if (!code) {
            showToast('Enter a coupon code', 'error');
            return;
        }

        try {
            const data = await apiFetch(`api/orders/coupon/${code}`);
            discountPercent = parseFloat(data.coupon.discount_percent);
            appliedCoupon = data.coupon;

            resultEl.className = 'coupon-result success';
            resultEl.textContent = `✓ ${data.coupon.code} applied — ${discountPercent}% off`;
            resultEl.classList.remove('hidden');

            updateSummary();
            showToast(`Coupon applied! ${discountPercent}% off`, 'success');

        } catch (err) {
            discountPercent = 0;
            appliedCoupon = null;
            resultEl.className = 'coupon-result error';
            resultEl.textContent = '✕ ' + err.message;
            resultEl.classList.remove('hidden');
            updateSummary();
        }
    });
}

// --- UPDATE SUMMARY ---
function updateSummary() {
    const subtotalEl = document.getElementById('summarySubtotal');
    const totalEl = document.getElementById('summaryTotal');
    const rows = document.getElementById('summaryRows');

    subtotalEl.textContent = formatPrice(cartTotal);

    // Remove old discount row if exists
    const oldDiscount = document.getElementById('discountRow');
    if (oldDiscount) oldDiscount.remove();

    let finalTotal = cartTotal;

    if (discountPercent > 0) {
        const discount = (cartTotal * discountPercent) / 100;
        finalTotal = cartTotal - discount;

        const discountRow = document.createElement('div');
        discountRow.className = 'summary-row';
        discountRow.id = 'discountRow';
        discountRow.innerHTML = `
            <span>Discount (${discountPercent}%)</span>
            <span class="summary-discount">−${formatPrice(discount)}</span>
        `;
        rows.appendChild(discountRow);
    }

    totalEl.textContent = formatPrice(finalTotal);
}

// --- CHECKOUT ---
function setupCheckout() {
    document.getElementById('checkoutBtn').addEventListener('click', () => {
        if (cartItems.length === 0) {
            showToast('Your cart is empty', 'error');
            return;
        }

        // Pass coupon to checkout page via URL
        const params = new URLSearchParams();
        if (appliedCoupon) params.set('coupon', appliedCoupon.coupon_id);
        window.location.href = `checkout.html?${params.toString()}`;
    });
}