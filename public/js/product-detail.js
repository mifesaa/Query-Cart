// =============================================
// Query Cart — product-detail.js
// =============================================

let currentProduct = null;
let quantity = 1;

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');

    if (!id) {
        window.location.href = 'products.html';
        return;
    }

    loadProduct(id);
});

// --- LOAD PRODUCT ---
async function loadProduct(id) {
    const wrap = document.getElementById('detailWrap');

    try {
        const data = await apiFetch(`/products/${id}`);
        currentProduct = data.product;

        // Breadcrumb
        document.title = `${currentProduct.name} — Query Cart`;
        document.getElementById('breadcrumbName').textContent = currentProduct.name;

        // Render main detail
        renderDetail(currentProduct);

        // Render reviews
        renderReviews(data.reviews, currentProduct.avg_rating, currentProduct.review_count);

        // Render related
        if (data.related && data.related.length > 0) {
            renderRelated(data.related);
        }

    } catch (err) {
        wrap.innerHTML = `
            <div style="text-align:center;padding:4rem">
                <div style="font-size:3rem;margin-bottom:1rem">😕</div>
                <h3 style="font-family:var(--font-display);color:var(--text)">Product not found</h3>
                <p style="color:var(--text-muted);margin:0.5rem 0 1.5rem">This product may have been removed.</p>
                <a href="products.html" class="cta-primary" style="display:inline-block">Back to Products</a>
            </div>
        `;
    }
}

// --- RENDER DETAIL ---
function renderDetail(p) {
    const wrap = document.getElementById('detailWrap');
    const icon = getProductIcon(p.category_name);
    const thumb = p.image_url
        ? `<img src="${p.image_url}" alt="${p.name}" />`
        : icon;
    const inStock = p.stock > 0;
    const lowStock = p.stock > 0 && p.stock < 5;

    let stockBadge = '';
    if (!inStock) stockBadge = `<span class="detail-stock-badge out">Out of Stock</span>`;
    else if (lowStock) stockBadge = `<span class="detail-stock-badge low">Only ${p.stock} left</span>`;
    else stockBadge = `<span class="detail-stock-badge">In Stock (${p.stock})</span>`;

    wrap.innerHTML = `
        <div class="detail-grid">
            <!-- LEFT -->
            <div class="detail-visual">
                <div class="detail-thumb">${thumb}</div>
                <div class="detail-shop-card">
                    <div class="detail-shop-info">
                        <span class="detail-shop-label">Sold by</span>
                        <span class="detail-shop-name">${p.shop_name}</span>
                    </div>
                
                </div>
            </div>

            <!-- RIGHT -->
            <div class="detail-info">
                <span class="detail-category-tag">${p.category_name}</span>

                <h1 class="detail-name">${p.name}</h1>

                <div class="detail-rating-row">
                    <span class="detail-stars">${renderStars(p.avg_rating)}</span>
                    <span class="detail-rating-num">${p.avg_rating || '0.0'}</span>
                    <span class="detail-review-count">(${p.review_count} review${p.review_count != 1 ? 's' : ''})</span>
                </div>

                <div class="detail-price-row">
                    <span class="detail-price">${formatPrice(p.price)}</span>
                    ${stockBadge}
                </div>

                <div class="detail-description">
                    ${p.description || 'No description available for this product.'}
                </div>

                ${inStock ? `
                <div class="detail-qty-row">
                    <span class="qty-label">Quantity</span>
                    <div class="qty-control">
                        <button class="qty-btn" id="qtyMinus">−</button>
                        <span class="qty-num" id="qtyNum">1</span>
                        <button class="qty-btn" id="qtyPlus">+</button>
                    </div>
                </div>` : ''}

                <div class="detail-actions">
                    <button class="detail-cart-btn" id="detailCartBtn" ${!inStock ? 'disabled' : ''}>
                        ${!inStock ? 'Out of Stock' : '🛒 Add to Cart'}
                    </button>
                    <button class="detail-wishlist-btn" id="detailWishlistBtn">♡ Wishlist</button>
                </div>

                <div class="detail-meta">
                    <div class="detail-meta-row">
                        <span class="detail-meta-key">Category</span>
                        <span class="detail-meta-val">${p.category_name}</span>
                    </div>
                    <div class="detail-meta-row">
                        <span class="detail-meta-key">Shop</span>
                        <span class="detail-meta-val">${p.shop_name}</span>
                    </div>
                    <div class="detail-meta-row">
                        <span class="detail-meta-key">Listed</span>
                        <span class="detail-meta-val">${new Date(p.created_at).toLocaleDateString('en-BD', { year:'numeric', month:'long', day:'numeric' })}</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Quantity controls
    if (inStock) {
        document.getElementById('qtyMinus').addEventListener('click', () => {
            if (quantity > 1) {
                quantity--;
                document.getElementById('qtyNum').textContent = quantity;
            }
        });

        document.getElementById('qtyPlus').addEventListener('click', () => {
            if (quantity < p.stock) {
                quantity++;
                document.getElementById('qtyNum').textContent = quantity;
            }
        });
    }

    // Cart button
    document.getElementById('detailCartBtn').addEventListener('click', async () => {
        await handleAddToCart(p.product_id, quantity);
    });

    // Wishlist button
    document.getElementById('detailWishlistBtn').addEventListener('click', async () => {
        await handleAddToWishlist(p.product_id);
    });
}

// --- RENDER REVIEWS (read-only) ---
function renderReviews(reviews, avgRating, reviewCount) {
    const wrap = document.getElementById('reviewsWrap');
    const list = document.getElementById('reviewsList');
    const summary = document.getElementById('reviewsSummary');

    wrap.classList.remove('hidden');

    // Summary box
    summary.innerHTML = `
        <span class="summary-num">${avgRating || '—'}</span>
        <span class="summary-stars">${renderStars(avgRating)}</span>
        <span class="summary-count">${reviewCount} review${reviewCount != 1 ? 's' : ''}</span>
    `;

    // Review cards
    if (reviews.length === 0) {
        list.innerHTML = '<div class="no-reviews">No reviews yet for this product.</div>';
    } else {
        list.innerHTML = '';
        reviews.forEach(r => {
            const card = document.createElement('div');
            card.className = 'review-card';
            card.innerHTML = `
                <div class="review-top">
                    <span class="review-author">${r.reviewer_name}</span>
                    <span class="review-date">${new Date(r.reviewed_at).toLocaleDateString('en-BD', { year:'numeric', month:'short', day:'numeric' })}</span>
                </div>
                <div class="review-stars">${renderStars(r.rating)}</div>
                <div class="review-comment">${r.comment || ''}</div>
            `;
            list.appendChild(card);
        });
    }
}

// --- RENDER RELATED ---
function renderRelated(related) {
    const wrap = document.getElementById('relatedWrap');
    const grid = document.getElementById('relatedGrid');
    wrap.classList.remove('hidden');
    grid.innerHTML = '';

    related.forEach(p => {
        const icon = getProductIcon(p.category_name);
        const card = document.createElement('div');
        card.className = 'related-card';
        card.innerHTML = `
            <div class="related-thumb">${icon}</div>
            <div class="related-body">
                <div class="related-name" title="${p.name}">${p.name}</div>
                <div class="related-shop">🏪 ${p.shop_name}</div>
                <div class="related-price">${formatPrice(p.price)}</div>
            </div>
        `;
        card.addEventListener('click', () => {
            window.location.href = `product-detail.html?id=${p.product_id}`;
        });
        grid.appendChild(card);
    });
}

// --- ADD TO CART ---
async function handleAddToCart(productId, qty) {
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

    const btn = document.getElementById('detailCartBtn');
    const original = btn.textContent;
    btn.textContent = 'Adding...';
    btn.disabled = true;

    try {
        await apiFetch('/cart', {
            method: 'POST',
            body: JSON.stringify({ product_id: productId, quantity: qty })
        });
        showToast('Added to cart!', 'success');
        updateCartCount();
        btn.textContent = '✓ Added to Cart';
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
async function handleAddToWishlist(productId) {
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

    const btn = document.getElementById('detailWishlistBtn');
    btn.disabled = true;

    try {
        await apiFetch('/cart/wishlist', {
            method: 'POST',
            body: JSON.stringify({ product_id: productId })
        });
        showToast('Added to wishlist!', 'success');
        btn.textContent = '♥ Wishlisted';
        btn.style.color = 'var(--accent)';
    } catch (err) {
        showToast(err.message, 'error');
        btn.disabled = false;
    }
}