// =============================================
// Query Cart — coupons.js (frontend)
// =============================================

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

    loadCoupons();
});

async function loadCoupons() {
    const grid = document.getElementById('couponsGrid');
    const emptyState = document.getElementById('emptyState');

    try {
        const data = await apiFetch('/orders/coupons');
        const coupons = data.coupons;

        if (coupons.length === 0) {
            grid.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }

        grid.innerHTML = '';

        coupons.forEach(c => {
            const card = document.createElement('div');
            card.className = 'coupon-card' + (c.already_used ? ' used' : '');

            const expiryStr = new Date(c.expiry_date).toLocaleDateString('en-BD', {
                year: 'numeric', month: 'short', day: 'numeric'
            });

            card.innerHTML = `
                <div class="coupon-discount">${c.discount_percent}% OFF</div>
                <div class="coupon-code-row">
                    <span class="coupon-code">${c.code}</span>
                    ${!c.already_used ? `<button class="copy-code-btn" data-code="${c.code}">Copy</button>` : ''}
                </div>
                <div class="coupon-expiry">Valid until ${expiryStr}</div>
                ${c.already_used ? `<span class="coupon-used-badge">Already Used</span>` : ''}
            `;
            grid.appendChild(card);
        });

        // Copy button handlers
        grid.querySelectorAll('.copy-code-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                navigator.clipboard.writeText(btn.dataset.code).then(() => {
                    const original = btn.textContent;
                    btn.textContent = 'Copied!';
                    btn.classList.add('copied');
                    setTimeout(() => {
                        btn.textContent = original;
                        btn.classList.remove('copied');
                    }, 1500);
                });
            });
        });

    } catch (err) {
        grid.innerHTML = `<p style="color:var(--error);text-align:center;padding:2rem">Failed to load coupons</p>`;
    }
}