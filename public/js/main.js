// =============================================
// ECOM — main.js (shared utilities)
// =============================================

const API = 'http://localhost:5030/api';

// --- AUTH HELPERS ---
function getUser() {
    const u = localStorage.getItem('ecom_user');
    return u ? JSON.parse(u) : null;
}

function getToken() {
    return localStorage.getItem('ecom_token');
}

function setUser(user, token) {
    localStorage.setItem('ecom_user', JSON.stringify(user));
    localStorage.setItem('ecom_token', token);
}

function clearUser() {
    localStorage.removeItem('ecom_user');
    localStorage.removeItem('ecom_token');
}

function isLoggedIn() {
    return !!getToken();
}

// --- API FETCH HELPER ---
async function apiFetch(endpoint, options = {}) {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API}${endpoint}`, { ...options, headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    return data;
}

// --- TOAST ---
function showToast(message, type = 'default') {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = `toast ${type}`;
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// --- CART COUNT ---
async function updateCartCount() {
    if (!isLoggedIn()) return;
    try {
        const data = await apiFetch('/cart');
        const count = data.items ? data.items.length : 0;
        const el = document.getElementById('cartCount');
        if (el) el.textContent = count;
    } catch (e) {}
}

// --- NAV AUTH STATE ---
function updateNav() {
    const user = getUser();
    const navAuth = document.getElementById('navAuth');
    const navUser = document.getElementById('navUser');
    const userNameEl = document.getElementById('userName');
    const cartLink = document.getElementById('cartLink');

    if (user) {
        if (navAuth) navAuth.classList.add('hidden');
        if (navUser) navUser.classList.remove('hidden');
        if (userNameEl) userNameEl.textContent = `Hi, ${user.name.split(' ')[0]}`;
        if (cartLink) cartLink.href = 'cart.html';
        updateCartCount();
    } else {
        if (navAuth) navAuth.classList.remove('hidden');
        if (navUser) navUser.classList.add('hidden');
        if (cartLink) cartLink.href = 'login.html';
    }
}

// --- LOGOUT ---
function setupLogout() {
    const btn = document.getElementById('logoutBtn');
    if (btn) {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            clearUser();
            showToast('Logged out successfully');
            setTimeout(() => window.location.href = 'index.html', 800);
        });
    }
}

// --- CATEGORY ICONS ---
const categoryIcons = {
    'Electronics': '💻',
    'Clothing': '👕',
    'Books': '📚',
    'Home Appliances': '🏠',
    'Sports': '⚽',
    'Beauty': '✨',
    'Groceries': '🛒',
    'Toys': '🧸',
};

function getCategoryIcon(name) {
    return categoryIcons[name] || '📦';
}

// --- PRODUCT ICON BY CATEGORY ---
function getProductIcon(categoryName) {
    return getCategoryIcon(categoryName);
}

// --- FORMAT PRICE ---
function formatPrice(price) {
    return `৳${Number(price).toLocaleString('en-BD')}`;
}

// --- RENDER STARS ---
function renderStars(rating) {
    if (!rating) return '☆☆☆☆☆';
    const full = Math.round(rating);
    return '★'.repeat(full) + '☆'.repeat(5 - full);
}

// Init on every page
document.addEventListener('DOMContentLoaded', () => {
    updateNav();
    setupLogout();
});