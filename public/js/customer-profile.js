// =============================================
// Query Cart — customer-profile.js (frontend)
// Part 1: Profile + Edit Profile tabs
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

    setupTabs();
    loadSidebar();
    loadProfile();
    setupEditProfile();
    setupChangePassword();
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

    if (tabName === 'orders') loadOrders && loadOrders();
    if (tabName === 'review') loadReviewProducts && loadReviewProducts();
}

// =============================================
// SIDEBAR
// =============================================
async function loadSidebar() {
    try {
        const data = await apiFetch('/auth/me');
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
        const data = await apiFetch('/auth/me');
        const user = data.user;

        // Get default address
        let defaultAddress = 'Not set';
        try {
            const addrData = await apiFetch('/orders/addresses');
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
    // Pre-fill form
    apiFetch('/auth/me').then(data => {
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
            const data = await apiFetch('/auth/profile', {
                method: 'PUT',
                body: JSON.stringify({ name, phone })
            });

            // Update local storage user info
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
            await apiFetch('/auth/password', {
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