// =============================================
// Query Cart — products.js (frontend)
// =============================================

let allCategories = [];
let activeFilters = {
    search: '',
    category: null,
    categoryName: '',
    minPrice: null,
    maxPrice: null,
    sort: 'newest'
};

document.addEventListener('DOMContentLoaded', () => {
    loadCategories();
    setupListeners();

    // If URL has category or search param, go straight to products
    const params = new URLSearchParams(window.location.search);
    if (params.get('category')) {
        activeFilters.category = params.get('category');
        showProductsSection();
        loadProducts();
    } else if (params.get('search')) {
        activeFilters.search = params.get('search');
        document.getElementById('searchInput').value = activeFilters.search;
        showProductsSection();
        loadProducts();
    }
});

// --- LOAD CATEGORIES ---
async function loadCategories() {
    const grid = document.getElementById('categoriesGrid');
    if (!grid) return;

    try {
        const data = await apiFetch('/products/categories');
        allCategories = data.categories;
        grid.innerHTML = '';

        data.categories.forEach(cat => {
            const icon = getCategoryIcon(cat.category_name);
            const card = document.createElement('div');
            card.className = 'category-big-card';
            card.innerHTML = `
                <div class="cat-big-name">${cat.category_name}</div>
                <div class="cat-big-icon">${icon}</div>
                <div class="cat-big-footer">
                    <span class="cat-big-count">${cat.product_count} products</span>
                    
                </div>
            `;
            card.addEventListener('click', () => {
                activeFilters.category = cat.category_id;
                activeFilters.categoryName = cat.category_name;
                showProductsSection();
                loadProducts();
            });
            grid.appendChild(card);
        });

    } catch (err) {
        grid.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem">Could not load categories.</p>';
    }
}

// --- SHOW/HIDE SECTIONS ---
function showProductsSection() {
    document.getElementById('categoriesSection').classList.add('hidden');
    document.getElementById('productsSection').classList.remove('hidden');
}

function showCategoriesSection() {
    document.getElementById('productsSection').classList.add('hidden');
    document.getElementById('categoriesSection').classList.remove('hidden');
    activeFilters.category = null;
    activeFilters.categoryName = '';
    activeFilters.search = '';
    document.getElementById('searchInput').value = '';
}

// --- SETUP LISTENERS ---
function setupListeners() {
    // Search button
    document.getElementById('searchBtn').addEventListener('click', () => {
        const val = document.getElementById('searchInput').value.trim();
        activeFilters.search = val;
        activeFilters.category = null;
        activeFilters.categoryName = '';
        if (val) {
            showProductsSection();
            loadProducts();
        } else {
            showCategoriesSection();
        }
    });

    // Search on Enter
    document.getElementById('searchInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('searchBtn').click();
    });

    // Apply filters
    document.getElementById('applyFilters').addEventListener('click', () => {
        activeFilters.minPrice = document.getElementById('minPrice').value || null;
        activeFilters.maxPrice = document.getElementById('maxPrice').value || null;
        activeFilters.sort = document.getElementById('sortSelect').value;
        if (activeFilters.category || activeFilters.search) {
            loadProducts();
        } else {
            // apply to all — show all products
            activeFilters.search = '';
            showProductsSection();
            loadProducts();
        }
    });

    // Back to categories
    document.getElementById('backToCategories').addEventListener('click', () => {
        showCategoriesSection();
    });
}

// --- LOAD PRODUCTS ---
async function loadProducts() {
    const grid = document.getElementById('productsGrid');
    const emptyState = document.getElementById('emptyState');
    const countEl = document.getElementById('productsCount');
    const headingEl = document.getElementById('productsHeading');
    const eyebrowEl = document.getElementById('productsEyebrow');

    grid.innerHTML = '<div class="spinner"></div>';
    emptyState.classList.add('hidden');

    try {
        let url = '/products?limit=40';
        if (activeFilters.category) url += `&category=${activeFilters.category}`;
        if (activeFilters.search)   url += `&search=${encodeURIComponent(activeFilters.search)}`;
        if (activeFilters.minPrice) url += `&minPrice=${activeFilters.minPrice}`;
        if (activeFilters.maxPrice) url += `&maxPrice=${activeFilters.maxPrice}`;
        if (activeFilters.sort)     url += `&sort=${activeFilters.sort}`;

        const data = await apiFetch(url);
        const products = data.products;

        // Update heading
        if (activeFilters.categoryName) {
            headingEl.textContent = activeFilters.categoryName;
            eyebrowEl.textContent = 'Category';
        } else if (activeFilters.search) {
            headingEl.textContent = `"${activeFilters.search}"`;
            eyebrowEl.textContent = 'Search results for';
        } else {
            headingEl.textContent = 'All Products';
            eyebrowEl.textContent = 'Showing';
        }

        if (countEl) countEl.textContent = `${products.length} product${products.length !== 1 ? 's' : ''}`;

        if (products.length === 0) {
            grid.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }

        grid.innerHTML = '';

        products.forEach(p => {
            const icon = getProductIcon(p.category_name);
            const inStock = p.stock > 0;
            const lowStock = p.stock > 0 && p.stock < 5;

            const card = document.createElement('div');
            card.className = 'product-card';
            card.innerHTML = `
                <div class="product-thumb">${icon}</div>
                <div class="product-body">
                    <div class="product-name" title="${p.name}">${p.name}</div>
                    <div class="product-shop">🏪 ${p.shop_name}</div>
                    <div class="product-meta">
                        <span class="product-category-tag">${p.category_name}</span>
                        <span class="product-stock ${lowStock ? 'low' : ''}">
                            ${!inStock ? 'Out of Stock' : lowStock ? `Only ${p.stock} left` : 'In Stock'}
                        </span>
                    </div>
                    <div class="product-footer">
                        <span class="product-price">${formatPrice(p.price)}</span>
                        <span class="product-rating">${renderStars(p.avg_rating)} (${p.review_count})</span>
                    </div>
                </div>
                <div class="product-actions">
                    <button class="wishlist-btn" data-id="${p.product_id}" title="Wishlist">♡</button>
                    <button class="cart-btn" data-id="${p.product_id}" ${!inStock ? 'disabled' : ''}>
                        ${!inStock ? 'Out of Stock' : 'Add to Cart'}
                    </button>
                </div>
            `;

            // Click to product detail
            card.addEventListener('click', (e) => {
                if (e.target.classList.contains('cart-btn') || e.target.classList.contains('wishlist-btn')) return;
                window.location.href = `product-detail.html?id=${p.product_id}`;
            });

            grid.appendChild(card);
        });

        // Cart buttons
        grid.querySelectorAll('.cart-btn:not([disabled])').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await handleAddToCart(btn.dataset.id, btn);
            });
        });

        // Wishlist buttons
        grid.querySelectorAll('.wishlist-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await handleAddToWishlist(btn.dataset.id, btn);
            });
        });

    } catch (err) {
        grid.innerHTML = `<p style="color:var(--error);text-align:center;padding:2rem">Failed to load products.</p>`;
    }
}

// --- ADD TO CART ---
async function handleAddToCart(productId, btn) {
    if (!isLoggedIn()) {
        showToast('Please login to add to cart', 'error');
        setTimeout(() => window.location.href = 'login.html', 1000);
        return;
    }
    const user = getUser();
    if (user.role === 'seller') {
        showToast('Sellers cannot add to cart', 'error');
        return;
    }

    const original = btn.textContent;
    btn.textContent = '...';
    btn.disabled = true;

    try {
        await apiFetch('/cart', {
            method: 'POST',
            body: JSON.stringify({ product_id: productId, quantity: 1 })
        });
        showToast('Added to cart!', 'success');
        updateCartCount();
        btn.textContent = '✓ Added';
        setTimeout(() => {
            btn.textContent = original;
            btn.disabled = false;
        }, 2000);
    } catch (err) {
        showToast(err.message, 'error');
        btn.textContent = original;
        btn.disabled = false;
    }
}

// --- ADD TO WISHLIST ---
async function handleAddToWishlist(productId, btn) {
    if (!isLoggedIn()) {
        showToast('Please login to save items', 'error');
        setTimeout(() => window.location.href = 'login.html', 1000);
        return;
    }
    const user = getUser();
    if (user.role === 'seller') {
        showToast('Sellers cannot add to wishlist', 'error');
        return;
    }

    btn.disabled = true;

    try {
        await apiFetch('/cart/wishlist', {
            method: 'POST',
            body: JSON.stringify({ product_id: productId })
        });
        showToast('Added to wishlist!', 'success');
        btn.textContent = '♥';
        btn.style.color = 'var(--accent)';
    } catch (err) {
        showToast(err.message, 'error');
        btn.disabled = false;
    }
}