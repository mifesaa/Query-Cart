// =============================================
// Query Cart — shops.js (frontend)
// =============================================

let allShops = [];

document.addEventListener('DOMContentLoaded', () => {
    loadCategoriesForFilter();
    loadShops();
    setupListeners();
});

// --- LOAD CATEGORIES FOR FILTER DROPDOWN ---
async function loadCategoriesForFilter() {
    try {
        const data = await apiFetch('api/products/categories');
        const select = document.getElementById('categoryFilter');
        data.categories.forEach(cat => {
            select.innerHTML += `<option value="${cat.category_id}">${cat.category_name}</option>`;
        });
    } catch (err) {}
}

// --- SETUP LISTENERS ---
function setupListeners() {
    document.getElementById('searchBtn').addEventListener('click', loadShops);

    document.getElementById('searchInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') loadShops();
    });

    document.getElementById('applyFilters').addEventListener('click', loadShops);
}

// --- LOAD SHOPS ---
async function loadShops() {
    const grid = document.getElementById('shopsGrid');
    const emptyState = document.getElementById('emptyState');
    const countEl = document.getElementById('shopsCount');

    grid.innerHTML = '<div class="spinner"></div>';
    emptyState.classList.add('hidden');

    const search   = document.getElementById('searchInput').value.trim();
    const category = document.getElementById('categoryFilter').value;
    const sort      = document.getElementById('sortSelect').value;

    try {
        let url = `shops?sort=${sort}`;
        if (search)   url += `&search=${encodeURIComponent(search)}`;
        if (category) url += `&category=${category}`;

        const data = await apiFetch(url);
        allShops = data.shops;

        countEl.textContent = `${allShops.length} shop${allShops.length !== 1 ? 's' : ''} found`;

        if (allShops.length === 0) {
            grid.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }

        grid.innerHTML = '';
        allShops.forEach(shop => {
            const card = document.createElement('div');
            card.className = 'shop-card';
            card.innerHTML = `
                <div class="shop-card-icon">🏪</div>
                <div class="shop-card-name">${shop.shop_name}</div>
                <div class="shop-card-rating">⭐ ${shop.rating ? Number(shop.rating).toFixed(2) : 'New'}</div>
                <div class="shop-card-products">${shop.product_count} product${shop.product_count != 1 ? 's' : ''}</div>
            `;
            card.addEventListener('click', () => {
                window.location.href = `shop-details.html?id=${shop.shop_id}`;
            });
            grid.appendChild(card);
        });

    } catch (err) {
        grid.innerHTML = `<p style="color:var(--error);text-align:center;padding:2rem">Failed to load shops.</p>`;
    }
}