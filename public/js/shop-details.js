// =============================================
// Query Cart — shop-details.js (frontend)
// =============================================

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');

    if (!id) {
        window.location.href = 'shops.html';
        return;
    }

    loadShop(id);
});

// --- LOAD SHOP ---
async function loadShop(id) {
    const headerWrap = document.getElementById('shopHeaderWrap');
    const grid = document.getElementById('productsGrid');
    const emptyState = document.getElementById('emptyState');
    const countEl = document.getElementById('productsCount');

    try {
        const data = await apiFetch(`api/shops/${id}`);
        const shop = data.shop;
        const products = data.products;

        document.title = `${shop.shop_name} — Query Cart`;
        document.getElementById('breadcrumbName').textContent = shop.shop_name;

        // Render header
        headerWrap.innerHTML = `
            <div class="shop-header-card">
                <div class="shop-header-icon">🏪</div>
                <div class="shop-header-info">
                    <div class="shop-header-name">${shop.shop_name}</div>
                    <div class="shop-header-seller">Run by ${shop.seller_name}</div>
                    <div class="shop-header-desc">${shop.description || 'This seller hasn\'t added a shop description yet.'}</div>
                </div>
                <div class="shop-header-stats">
                    <div class="shop-stat-pill">
                        <span class="shop-stat-num">⭐ ${shop.rating ? Number(shop.rating).toFixed(2) : 'New'}</span>
                        <span class="shop-stat-label">Shop Rating</span>
                    </div>
                    <div class="shop-stat-pill">
                        <span class="shop-stat-num">${shop.product_count}</span>
                        <span class="shop-stat-label">Products</span>
                    </div>
                </div>
            </div>
        `;

        // Render products
        countEl.textContent = `${products.length} product${products.length !== 1 ? 's' : ''}`;

        if (products.length === 0) {
            grid.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }

        grid.innerHTML = '';

        products.forEach(p => {
            const icon = getProductIcon(p.category_name);
            const thumb = p.image_url ? `<img src="${p.image_url}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover" />` : icon;
            const inStock = p.stock > 0;
            const lowStock = p.stock > 0 && p.stock < 5;

            const card = document.createElement('div');
            card.className = 'product-card';
            card.innerHTML = `
                <div class="product-thumb">${thumb}</div>
                <div class="product-body">
                    <div class="product-name" title="${p.name}">${p.name}</div>
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
            `;
            card.addEventListener('click', () => {
                window.location.href = `product-detail.html?id=${p.product_id}`;
            });
            grid.appendChild(card);
        });

    } catch (err) {
        headerWrap.innerHTML = `
            <div style="text-align:center;padding:2rem">
                <div style="font-size:3rem;margin-bottom:1rem">😕</div>
                <h3 style="font-family:var(--font-display);color:var(--text)">Shop not found</h3>
                <p style="color:var(--text-muted);margin:0.5rem 0 1.5rem">This shop may not exist or is inactive.</p>
                <a href="shops.html" class="cta-primary" style="display:inline-block">Back to Shops</a>
            </div>
        `;
        grid.innerHTML = '';
    }
}