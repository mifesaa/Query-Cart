// =============================================
// Query Cart — seller-profile.js
// =============================================

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

    loadProfile();
});

async function loadProfile() {
    const wrap = document.getElementById('profileWrap');

    try {
        const [userData, shopStatus] = await Promise.all([
            apiFetch('/auth/me'),
            apiFetch('/seller/shop/status')
        ]);

        const user = userData.user;
        const hasShop = shopStatus.has_shop;
        const shop = shopStatus.shop;

        const initials = user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

        wrap.innerHTML = `
            <!-- AVATAR CARD -->
            <div class="profile-avatar-card">
                <div class="profile-avatar">${initials}</div>
                <div class="profile-name">${user.name}</div>
                <span class="profile-role-badge">Seller</span>
            </div>

            <!-- ACCOUNT INFO -->
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
                    <span class="profile-info-key">Member Since</span>
                    <span class="profile-info-val">${new Date(user.created_at).toLocaleDateString('en-BD', { year:'numeric', month:'long', day:'numeric' })}</span>
                </div>
            </div>

            <!-- SHOP SUMMARY -->
            <div class="profile-shop-card">
                ${hasShop ? `
                    <div class="profile-shop-header">
                        <div>
                            <div class="profile-shop-name">${shop.shop_name}</div>
                            <span class="profile-shop-status ${shop.is_active ? 'active' : 'inactive'}">
                                ${shop.is_active ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                        <div class="profile-shop-rating">⭐ ${shop.rating || '0.00'}</div>
                    </div>
                    <div class="profile-shop-desc">
                        ${shop.description || 'No shop description added yet.'}
                    </div>
                    <a href="seller-dashboard.html" class="profile-shop-link">Manage My Shop</a>
                ` : `
                    <div class="profile-no-shop">
                        <p>You haven't created a shop yet.</p>
                        <a href="seller-dashboard.html" class="profile-shop-link">Create Shop →</a>
                    </div>
                `}
            </div>
        `;

    } catch (err) {
        wrap.innerHTML = `<p style="color:var(--error);text-align:center;padding:2rem">Failed to load profile</p>`;
    }
}