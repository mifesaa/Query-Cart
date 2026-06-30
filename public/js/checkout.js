// =============================================
// Query Cart — checkout.js (frontend)
// =============================================

let cartData = null;
let selectedAddressId = null;
let couponId = null;
let discountPercent = 0;

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

    // Get coupon from URL if passed from cart
    const params = new URLSearchParams(window.location.search);
    couponId = params.get('coupon') || null;

    loadCart();
    loadAddresses();
    setupAddAddress();
    setupPlaceOrder();
});

// --- LOAD CART ---
async function loadCart() {
    try {
        cartData = await apiFetch('api/cart');

        if (cartData.items.length === 0) {
            window.location.href = 'cart.html';
            return;
        }

        renderCheckoutItems(cartData.items);
        await computeSummary(cartData.total);

    } catch (err) {
        showToast('Failed to load cart', 'error');
    }
}

// --- RENDER ITEMS ---
function renderCheckoutItems(items) {
    const list = document.getElementById('checkoutItemsList');
    list.innerHTML = '';

    items.forEach(item => {
        const icon = getProductIcon(item.category_name);
        const thumb = item.image_url
            ? `<img src="${item.image_url}" alt="${item.name}" />`
            : icon;

        const div = document.createElement('div');
        div.className = 'checkout-item';
        div.innerHTML = `
            <div class="checkout-item-thumb">${thumb}</div>
            <div class="checkout-item-info">
                <div class="checkout-item-name">${item.name}</div>
                <div class="checkout-item-shop">🏪 ${item.shop_name}</div>
            </div>
            <span class="checkout-item-qty">x${item.quantity}</span>
            <span class="checkout-item-price">${formatPrice(item.price * item.quantity)}</span>
        `;
        list.appendChild(div);
    });
}

// --- COMPUTE SUMMARY ---
async function computeSummary(subtotal) {
    const subEl  = document.getElementById('coSubtotal');
    const totalEl = document.getElementById('coTotal');
    const discountRow = document.getElementById('coDiscountRow');
    const discountEl  = document.getElementById('coDiscount');
    const discountLabel = document.getElementById('coDiscountLabel');

    subtotal = parseFloat(subtotal);
    subEl.textContent = formatPrice(subtotal);

    let finalTotal = subtotal;

    if (couponId) {
        try {
            const data = await apiFetch(`api/orders/coupon/by-id/${couponId}`);
            discountPercent = parseFloat(data.coupon.discount_percent);
            const discount = (subtotal * discountPercent) / 100;
            finalTotal = subtotal - discount;

            discountLabel.textContent = `Discount (${discountPercent}%)`;
            discountEl.textContent = `−${formatPrice(discount)}`;
            discountRow.style.display = 'flex';
        } catch (err) {
            couponId = null;
        }
    }

    totalEl.textContent = formatPrice(finalTotal);
}

// --- LOAD ADDRESSES ---
async function loadAddresses() {
    const list = document.getElementById('addressList');

    try {
        const data = await apiFetch('api/orders/addresses');
        const addresses = data.addresses;

        if (addresses.length === 0) {
            list.innerHTML = '<p style="color:var(--text-muted);font-size:0.88rem">No saved addresses. Add one below.</p>';
            return;
        }

        list.innerHTML = '';

        addresses.forEach((addr, idx) => {
            const div = document.createElement('label');
            div.className = 'address-option' + (idx === 0 ? ' selected' : '');
            div.innerHTML = `
                <input type="radio" name="address" value="${addr.address_id}" ${idx === 0 ? 'checked' : ''} />
                <div class="address-body">
                    <div class="address-street">
                        ${addr.street}
                        ${addr.is_default ? '<span class="address-default-badge">Default</span>' : ''}
                    </div>
                    <div class="address-city">${addr.city}${addr.postal_code ? ', ' + addr.postal_code : ''}</div>
                </div>
            `;
            list.appendChild(div);

            if (idx === 0) selectedAddressId = addr.address_id;
        });

        // Track selection
        list.querySelectorAll('input[type="radio"]').forEach(radio => {
            radio.addEventListener('change', () => {
                document.querySelectorAll('.address-option').forEach(o => o.classList.remove('selected'));
                radio.closest('.address-option').classList.add('selected');
                selectedAddressId = radio.value;
            });
        });

    } catch (err) {
        list.innerHTML = '<p style="color:var(--error);font-size:0.88rem">Could not load addresses</p>';
    }
}

// --- ADD NEW ADDRESS ---
function setupAddAddress() {
    const toggle = document.getElementById('addAddressToggle');
    const form   = document.getElementById('addAddressForm');
    const saveBtn = document.getElementById('saveAddressBtn');

    toggle.addEventListener('click', () => {
        form.classList.toggle('hidden');
        toggle.textContent = form.classList.contains('hidden')
            ? '+ Add a new address'
            : '− Cancel';
    });

    saveBtn.addEventListener('click', async () => {
        const street = document.getElementById('newStreet').value.trim();
        const city   = document.getElementById('newCity').value.trim();
        const postal = document.getElementById('newPostal').value.trim();

        if (!street || !city) {
            showToast('Street and city are required', 'error');
            return;
        }

        saveBtn.textContent = 'Saving...';
        saveBtn.disabled = true;

        try {
            await apiFetch('api/orders/addresses', {
                method: 'POST',
                body: JSON.stringify({ street, city, postal_code: postal })
            });
            showToast('Address saved!', 'success');
            form.classList.add('hidden');
            toggle.textContent = '+ Add a new address';
            document.getElementById('newStreet').value = '';
            document.getElementById('newCity').value = '';
            document.getElementById('newPostal').value = '';
            loadAddresses();
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            saveBtn.textContent = 'Save Address';
            saveBtn.disabled = false;
        }
    });
}

// --- PLACE ORDER ---
function setupPlaceOrder() {
    const btn = document.getElementById('placeOrderBtn');

    btn.addEventListener('click', async () => {
        if (!selectedAddressId) {
            showToast('Please select a delivery address', 'error');
            return;
        }

        const paymentMethod = document.querySelector('input[name="payment"]:checked').value;

        btn.textContent = 'Placing order...';
        btn.disabled = true;

        try {
            const data = await apiFetch('api/orders', {
                method: 'POST',
                body: JSON.stringify({
                    address_id: selectedAddressId,
                    coupon_id: couponId || null,
                    payment_method: paymentMethod
                })
            });

            updateCartCount();
            window.location.href = `order-success.html?order_id=${data.order_id}`;

        } catch (err) {
            showToast(err.message, 'error');
            btn.textContent = 'Place Order →';
            btn.disabled = false;
        }
    });
}