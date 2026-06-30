// =============================================
// Query Cart — auth.js (frontend)
// =============================================

document.addEventListener('DOMContentLoaded', () => {
    // Redirect if already logged in
    if (isLoggedIn()) {
        const user = getUser();
        if (user.role === 'seller') {
            window.location.href = 'seller-dashboard.html';
        } else {
            window.location.href = 'index.html';
        }
        return;
    }

    setupLoginForm();
    setupRegisterForm();
});

// --- LOGIN ---
function setupLoginForm() {
    const form = document.getElementById('loginForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = form.querySelector('.form-btn');
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;

        if (!email || !password) {
            showToast('Please fill in all fields', 'error');
            return;
        }

        btn.textContent = 'Logging in...';
        btn.disabled = true;

        try {
            const data = await apiFetch('api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });

            setUser(data.user, data.token);
            showToast('Welcome back, ' + data.user.name.split(' ')[0] + '!', 'success');

            setTimeout(() => {
                if (data.user.role === 'seller') {
                    window.location.href = 'seller-dashboard.html';
                } else {
                    window.location.href = 'index.html';
                }
            }, 800);

        } catch (err) {
            showToast(err.message, 'error');
            btn.textContent = 'Login';
            btn.disabled = false;
        }
    });
}

// --- REGISTER ---
function setupRegisterForm() {
    const form = document.getElementById('registerForm');
    if (!form) return;

    // Role toggle
    const roleBtns = document.querySelectorAll('.role-btn');
    let selectedRole = 'customer';

    roleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            roleBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedRole = btn.dataset.role;

            // Show/hide shop name field
            const shopGroup = document.getElementById('shopNameGroup');
            if (shopGroup) {
                shopGroup.style.display = selectedRole === 'seller' ? 'flex' : 'none';
            }
        });
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = form.querySelector('.form-btn');

        const name     = document.getElementById('regName').value.trim();
        const email    = document.getElementById('regEmail').value.trim();
        const phone    = document.getElementById('regPhone').value.trim();
        const password = document.getElementById('regPassword').value;
        const confirm  = document.getElementById('regConfirm').value;

        if (!name || !email || !phone || !password || !confirm) {
            showToast('Please fill in all fields', 'error');
            return;
        }

        if (password !== confirm) {
            showToast('Passwords do not match', 'error');
            return;
        }

        if (password.length < 6) {
            showToast('Password must be at least 6 characters', 'error');
            return;
        }

        btn.textContent = 'Creating account...';
        btn.disabled = true;

        try {
            const data = await apiFetch('api/auth/register', {
                method: 'POST',
                body: JSON.stringify({ name, email, phone, password, role: selectedRole })
            });

            setUser(data.user, data.token);
            showToast('Account created! Welcome, ' + data.user.name.split(' ')[0] + '!', 'success');

            setTimeout(() => {
                if (data.user.role === 'seller') {
                    window.location.href = 'seller-dashboard.html';
                } else {
                    window.location.href = 'index.html';
                }
            }, 800);

        } catch (err) {
            showToast(err.message, 'error');
            btn.textContent = 'Create Account';
            btn.disabled = false;
        }
    });
}