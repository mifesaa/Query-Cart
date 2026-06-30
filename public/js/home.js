// =============================================
// ECOM — home.js (homepage logic)
// =============================================

document.addEventListener('DOMContentLoaded', () => {
    loadCategories();
    loadFeaturedProducts();
});

// --- LOAD CATEGORIES ---
async function loadCategories() {
    const grid = document.getElementById('categoriesGrid');
    if (!grid) return;

    grid.innerHTML = '<div class="spinner"></div>';

    try {
        const data = await apiFetch('api/products/categories');
        grid.innerHTML = '';

        data.categories.forEach(cat => {
            const icon = getCategoryIcon(cat.category_name);
            const card = document.createElement('a');
            card.href = `products.html?category=${cat.category_id}`;
            card.className = 'category-card';
            card.innerHTML = `
                <span class="cat-icon">${icon}</span>
                <div class="cat-name">${cat.category_name}</div>
                <div class="cat-count">${cat.product_count} products</div>
            `;
            grid.appendChild(card);
        });
    } catch (err) {
        grid.innerHTML = '<p style="color:var(--text-muted);text-align:center">Could not load categories.</p>';
    }
}

// --- LOAD FEATURED PRODUCTS ---
async function loadFeaturedProducts() {
    const grid = document.getElementById('featuredGrid');
    if (!grid) return;

    grid.innerHTML = '<div class="spinner"></div>';

    try {
        const data = await apiFetch('api/products?limit=8');
        grid.innerHTML = '';

        data.products.forEach(p => {
            const icon = getProductIcon(p.category_name);
            const card = document.createElement('div');
            card.className = 'product-card';
            card.innerHTML = `
                <div class="product-thumb">${icon}</div>
                <div class="product-body">
                    <div class="product-name">${p.name}</div>
                    <div class="product-shop">🏪 ${p.shop_name}</div>
                    <div class="product-footer">
                        <span class="product-price">${formatPrice(p.price)}</span>
                        <span class="product-rating">${renderStars(p.avg_rating)}</span>
                    </div>
                </div>
                <button class="add-to-cart-btn" data-id="${p.product_id}">+ Cart</button>
            `;
            card.addEventListener('click', (e) => {
                if (e.target.classList.contains('add-to-cart-btn')) return;
                window.location.href = `product-detail.html?id=${p.product_id}`;
            });
            grid.appendChild(card);
        });

        // cart buttons
        grid.querySelectorAll('.add-to-cart-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
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
                try {
                    await apiFetch('api/cart', {
                        method: 'POST',
                        body: JSON.stringify({ product_id: btn.dataset.id, quantity: 1 })
                    });
                    showToast('Added to cart!', 'success');
                    updateCartCount();
                } catch (err) {
                    showToast(err.message, 'error');
                }
            });
        });

    } catch (err) {
        grid.innerHTML = '<p style="color:var(--text-muted);text-align:center">Could not load products.</p>';
    }
}