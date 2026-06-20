// =============================================
// Query Cart — routes/seller.js
// =============================================

const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireAuth, requireSeller } = require('../middleware/auth');

// --- MULTER SETUP ---
const uploadDir = path.join(__dirname, '../public/uploads/products');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext  = path.extname(file.originalname);
        const name = `product_${Date.now()}${ext}`;
        cb(null, name);
    }
});

const fileFilter = (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Only images allowed'));
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

// --- HELPER ---
async function getShopId(user_id) {
    const result = await db.query('SELECT shop_id FROM shops WHERE user_id = $1', [user_id]);
    return result.rows.length > 0 ? result.rows[0].shop_id : null;
}

// =============================================
// SHOP
// =============================================

// GET /api/seller/shop/status — check if seller has a shop
router.get('/shop/status', requireAuth, requireSeller, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT shop_id, shop_name, description, rating, is_active FROM shops WHERE user_id = $1',
            [req.user.user_id]
        );

        if (result.rows.length === 0) {
            return res.json({ has_shop: false, shop: null });
        }

        res.json({ has_shop: true, shop: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to check shop status' });
    }
});

// POST /api/seller/shop — create shop (one-time)
router.post('/shop', requireAuth, requireSeller, async (req, res) => {
    try {
        const { shop_name, description } = req.body;

        if (!shop_name || !shop_name.trim()) {
            return res.status(400).json({ error: 'Shop name is required' });
        }

        const existing = await db.query(
            'SELECT shop_id FROM shops WHERE user_id = $1',
            [req.user.user_id]
        );
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'You already have a shop' });
        }

        const nameTaken = await db.query(
            'SELECT shop_id FROM shops WHERE shop_name = $1',
            [shop_name.trim()]
        );
        if (nameTaken.rows.length > 0) {
            return res.status(409).json({ error: 'Shop name already taken, choose another' });
        }

        const result = await db.query(
            `INSERT INTO shops (user_id, shop_name, description, is_active)
             VALUES ($1, $2, $3, TRUE)
             RETURNING shop_id, shop_name, description, rating, is_active`,
            [req.user.user_id, shop_name.trim(), description || '']
        );

        res.status(201).json({ message: 'Shop created successfully', shop: result.rows[0] });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create shop' });
    }
});

// GET /api/seller/shop
router.get('/shop', requireAuth, requireSeller, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM shops WHERE user_id = $1',
            [req.user.user_id]
        );
        if (result.rows.length === 0) {
            return res.json({ shop: null });
        }
        res.json({ shop: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch shop' });
    }
});

// PUT /api/seller/shop
router.put('/shop', requireAuth, requireSeller, async (req, res) => {
    try {
        const { shop_name, description, is_active } = req.body;
        if (!shop_name)
            return res.status(400).json({ error: 'Shop name is required' });

        const existing = await db.query(
            'SELECT shop_id FROM shops WHERE shop_name = $1 AND user_id != $2',
            [shop_name, req.user.user_id]
        );
        if (existing.rows.length > 0)
            return res.status(409).json({ error: 'Shop name already taken' });

        await db.query(
            `UPDATE shops SET shop_name=$1, description=$2, is_active=$3 WHERE user_id=$4`,
            [shop_name, description || '', is_active, req.user.user_id]
        );
        res.json({ message: 'Shop updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update shop' });
    }
});

// =============================================
// OVERVIEW
// =============================================

// GET /api/seller/overview
router.get('/overview', requireAuth, requireSeller, async (req, res) => {
    try {
        const shop_id = await getShopId(req.user.user_id);
        if (!shop_id) {
            return res.status(400).json({ error: 'Please create your shop first in Shop Settings' });
        }

        const [products, orders, revenue, recentOrders, lowStock] = await Promise.all([
            db.query(`
                SELECT
                    COUNT(*) AS total,
                    COUNT(*) FILTER (WHERE is_available = TRUE) AS active
                FROM products WHERE shop_id = $1
            `, [shop_id]),

            db.query(`
                SELECT COUNT(DISTINCT o.order_id) AS total
                FROM orders o
                JOIN order_items oi ON o.order_id = oi.order_id
                JOIN products p ON oi.product_id = p.product_id
                WHERE p.shop_id = $1
            `, [shop_id]),

            db.query(`
                SELECT COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS total
                FROM order_items oi
                JOIN products p ON oi.product_id = p.product_id
                JOIN orders o ON oi.order_id = o.order_id
                WHERE p.shop_id = $1
                  AND o.status != 'cancelled'
            `, [shop_id]),

            db.query(`
                SELECT DISTINCT
                    o.order_id, o.total_amount, o.status, o.ordered_at
                FROM orders o
                JOIN order_items oi ON o.order_id = oi.order_id
                JOIN products p ON oi.product_id = p.product_id
                WHERE p.shop_id = $1
                ORDER BY o.ordered_at DESC
                LIMIT 5
            `, [shop_id]),

            db.query(`
                SELECT product_id, name, stock
                FROM products
                WHERE shop_id = $1 AND stock < 5 AND is_available = TRUE
                ORDER BY stock ASC
            `, [shop_id])
        ]);

        res.json({
            total_products:  parseInt(products.rows[0].total),
            active_products: parseInt(products.rows[0].active),
            total_orders:    parseInt(orders.rows[0].total),
            total_revenue:   parseFloat(revenue.rows[0].total),
            recent_orders:   recentOrders.rows,
            low_stock:       lowStock.rows
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to load overview' });
    }
});

// =============================================
// PRODUCTS
// =============================================

// GET /api/seller/products
router.get('/products', requireAuth, requireSeller, async (req, res) => {
    try {
        const shop_id = await getShopId(req.user.user_id);
        if (!shop_id) {
            return res.status(400).json({ error: 'Please create your shop first in Shop Settings' });
        }

        const result = await db.query(`
            SELECT
                p.product_id, p.name, p.description, p.price,
                p.stock, p.is_available, p.image_url, p.created_at,
                p.category_id,
                c.category_name
            FROM products p
            JOIN categories c ON p.category_id = c.category_id
            WHERE p.shop_id = $1
            ORDER BY p.created_at DESC
        `, [shop_id]);

        res.json({ products: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// POST /api/seller/products — add product
router.post('/products', requireAuth, requireSeller, upload.single('image'), async (req, res) => {
    try {
        const shop_id = await getShopId(req.user.user_id);
        if (!shop_id) {
            return res.status(400).json({ error: 'Please create your shop first in Shop Settings' });
        }

        const { name, category_id, price, stock, description, is_available } = req.body;

        if (!name || !category_id || !price || stock === undefined)
            return res.status(400).json({ error: 'Name, category, price and stock are required' });

        const image_url = req.file ? `/uploads/products/${req.file.filename}` : null;

        await db.query(`
            INSERT INTO products (shop_id, category_id, name, description, price, stock, is_available, image_url)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [shop_id, category_id, name, description || '', price, stock,
            is_available === 'false' ? false : true, image_url]);

        res.status(201).json({ message: 'Product added successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to add product' });
    }
});

// PUT /api/seller/products/:id — edit product
router.put('/products/:id', requireAuth, requireSeller, upload.single('image'), async (req, res) => {
    try {
        const shop_id = await getShopId(req.user.user_id);
        if (!shop_id) {
            return res.status(400).json({ error: 'Please create your shop first in Shop Settings' });
        }

        const { id } = req.params;
        const { name, category_id, price, stock, description, is_available } = req.body;

        const existing = await db.query(
            'SELECT product_id, image_url FROM products WHERE product_id = $1 AND shop_id = $2',
            [id, shop_id]
        );
        if (existing.rows.length === 0)
            return res.status(403).json({ error: 'Product not found or not yours' });

        let image_url = existing.rows[0].image_url;

        if (req.file) {
            if (image_url) {
                const oldPath = path.join(__dirname, '../public', image_url);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
            image_url = `/uploads/products/${req.file.filename}`;
        }

        await db.query(`
            UPDATE products
            SET name=$1, category_id=$2, price=$3, stock=$4,
                description=$5, is_available=$6, image_url=$7
            WHERE product_id=$8
        `, [name, category_id, price, stock, description || '',
            is_available === 'false' ? false : true, image_url, id]);

        res.json({ message: 'Product updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update product' });
    }
});

// PATCH /api/seller/products/:id/toggle — toggle availability
router.patch('/products/:id/toggle', requireAuth, requireSeller, async (req, res) => {
    try {
        const shop_id = await getShopId(req.user.user_id);
        if (!shop_id) {
            return res.status(400).json({ error: 'Please create your shop first in Shop Settings' });
        }

        const { id } = req.params;

        await db.query(`
            UPDATE products
            SET is_available = NOT is_available
            WHERE product_id = $1 AND shop_id = $2
        `, [id, shop_id]);

        res.json({ message: 'Availability toggled' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to toggle availability' });
    }
});

// DELETE /api/seller/products/:id
router.delete('/products/:id', requireAuth, requireSeller, async (req, res) => {
    try {
        const shop_id = await getShopId(req.user.user_id);
        if (!shop_id) {
            return res.status(400).json({ error: 'Please create your shop first in Shop Settings' });
        }

        const { id } = req.params;

        const product = await db.query(
            'SELECT image_url FROM products WHERE product_id = $1 AND shop_id = $2',
            [id, shop_id]
        );
        if (product.rows.length === 0)
            return res.status(403).json({ error: 'Product not found or not yours' });

        if (product.rows[0].image_url) {
            const imgPath = path.join(__dirname, '../public', product.rows[0].image_url);
            if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
        }

        await db.query('DELETE FROM products WHERE product_id = $1', [id]);
        res.json({ message: 'Product deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

// =============================================
// ORDERS
// =============================================

// GET /api/seller/orders
router.get('/orders', requireAuth, requireSeller, async (req, res) => {
    try {
        const shop_id = await getShopId(req.user.user_id);
        if (!shop_id) {
            return res.status(400).json({ error: 'Please create your shop first in Shop Settings' });
        }

        const ordersResult = await db.query(`
            SELECT DISTINCT
                o.order_id, o.total_amount, o.status, o.ordered_at,
                u.name AS customer_name,
                a.street, a.city
            FROM orders o
            JOIN order_items oi ON o.order_id = oi.order_id
            JOIN products p     ON oi.product_id = p.product_id
            JOIN users u        ON o.user_id = u.user_id
            JOIN addresses a    ON o.address_id = a.address_id
            WHERE p.shop_id = $1
            ORDER BY o.ordered_at DESC
        `, [shop_id]);

        const orders = await Promise.all(ordersResult.rows.map(async (order) => {
            const itemsResult = await db.query(`
                SELECT
                    oi.item_id, oi.quantity, oi.unit_price,
                    p.product_id, p.name, p.image_url,
                    cat.category_name
                FROM order_items oi
                JOIN products p     ON oi.product_id = p.product_id
                JOIN categories cat ON p.category_id = cat.category_id
                WHERE oi.order_id = $1 AND p.shop_id = $2
            `, [order.order_id, shop_id]);

            return { ...order, items: itemsResult.rows };
        }));

        res.json({ orders });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// PATCH /api/seller/orders/:id/status
router.patch('/orders/:id/status', requireAuth, requireSeller, async (req, res) => {
    try {
        const shop_id = await getShopId(req.user.user_id);
        if (!shop_id) {
            return res.status(400).json({ error: 'Please create your shop first in Shop Settings' });
        }

        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ['pending', 'processing', 'shipped', 'cancelled'];
        if (!validStatuses.includes(status))
            return res.status(400).json({ error: 'Invalid status' });

        const check = await db.query(`
            SELECT o.order_id FROM orders o
            JOIN order_items oi ON o.order_id = oi.order_id
            JOIN products p ON oi.product_id = p.product_id
            WHERE o.order_id = $1 AND p.shop_id = $2
            LIMIT 1
        `, [id, shop_id]);

        if (check.rows.length === 0)
            return res.status(403).json({ error: 'Order not found' });

        await db.query(
            'UPDATE orders SET status = $1 WHERE order_id = $2',
            [status, id]
        );

        res.json({ message: 'Order status updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update order status' });
    }
});

module.exports = router;