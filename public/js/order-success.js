// =============================================
// Query Cart — order-success.js
// =============================================

document.addEventListener('DOMContentLoaded', () => {
    if (!isLoggedIn()) {
        window.location.href = 'login.html';
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('order_id');

    if (!orderId) {
        window.location.href = 'index.html';
        return;
    }

    loadOrderSuccess(orderId);
});

async function loadOrderSuccess(orderId) {
    const card = document.getElementById('successCard');

    try {
        const data = await apiFetch(`api/orders/${orderId}`);
        const order = data.order;
        const items = data.items;

        card.innerHTML = `
            <div class="success-icon">🎉</div>
            <h1 class="success-title">Order Placed!</h1>
            <p class="success-sub">Thank you for your purchase. Your order has been received and is being processed.</p>

            <div class="order-id-badge">Order #${order.order_id}</div>

            <div class="success-order-details">
                <div class="success-detail-row">
                    <span class="success-detail-key">Total Amount</span>
                    <span class="success-detail-val accent">${formatPrice(order.total_amount)}</span>
                </div>
                <div class="success-detail-row">
                    <span class="success-detail-key">Payment</span>
                    <span class="success-detail-val">${formatPaymentMethod(order.payment_method)}</span>
                </div>
                <div class="success-detail-row">
                    <span class="success-detail-key">Status</span>
                    <span class="success-detail-val"><span class="status-badge">${order.status}</span></span>
                </div>
                <div class="success-detail-row">
                    <span class="success-detail-key">Deliver to</span>
                    <span class="success-detail-val">${order.street}, ${order.city}</span>
                </div>
                ${order.coupon_code ? `
                <div class="success-detail-row">
                    <span class="success-detail-key">Coupon</span>
                    <span class="success-detail-val">${order.coupon_code} (${order.discount_percent}% off)</span>
                </div>` : ''}
            </div>

            <div class="success-items">
                <div class="success-items-title">Items Ordered</div>
                ${items.map(item => {
                    const icon = getProductIcon(item.category_name);
                    const thumb = item.image_url
                        ? `<img src="${item.image_url}" alt="${item.name}" />`
                        : icon;
                    return `
                        <div class="success-item">
                            <div class="success-item-icon">${thumb}</div>
                            <div class="success-item-name">${item.name}</div>
                            <div class="success-item-qty">x${item.quantity}</div>
                            <div class="success-item-price">${formatPrice(item.unit_price * item.quantity)}</div>
                        </div>
                    `;
                }).join('')}
            </div>

            <div class="success-actions">
                <a href="products.html" class="cta-primary">Continue Shopping</a>
                <a href="index.html" class="btn-ghost">Back to Home</a>
            </div>
        `;

    } catch (err) {
        card.innerHTML = `
            <div class="success-icon">✅</div>
            <h1 class="success-title">Order Placed!</h1>
            <p class="success-sub">Your order #${orderId} has been placed successfully.</p>
            <div class="success-actions">
                <a href="products.html" class="cta-primary">Continue Shopping</a>
            </div>
        `;
    }
}

function formatPaymentMethod(method) {
    const map = {
        'mobile_banking': '📱 Mobile Banking',
        'card': '💳 Card',
        'cash': '💵 Cash on Delivery'
    };
    return map[method] || method;
}