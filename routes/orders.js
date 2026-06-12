// =============================================
// Query Cart — routes/orders.js
// =============================================

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireCustomer } = require('../middleware/auth');

// GET /api/orders/coupon/:code — validate coupon by code
router.get('/coupon/:code', async (req, res) => {
    try {
        const { code } = req.params;
        const result = await db.query(`
            SELECT coupon_id, code, discount_percent, expiry_date, is_active
            FROM coupons WHERE UPPER(code) = UPPER($1)
        `, [code]);

        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Coupon not found' });

        const coupon = result.rows[0];
        if (!coupon.is_active)
            return res.status(400).json({ error: 'Coupon is no longer active' });
        if (new Date(coupon.expiry_date) < new Date())
            return res.status(400).json({ error: 'Coupon has expired' });

        res.json({ coupon });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to validate coupon' });
    }
});

// GET /api/orders/coupon/by-id/:id — get coupon by ID (for checkout)
router.get('/coupon/by-id/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query(`
            SELECT coupon_id, code, discount_percent, expiry_date, is_active
            FROM coupons WHERE coupon_id = $1
        `, [id]);

        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Coupon not found' });

        res.json({ coupon: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch coupon' });
    }
});

// GET /api/orders/addresses — get user saved addresses
router.get('/addresses', requireAuth, async (req, res) => {
    try {
        const user_id = req.user.user_id;
        const result = await db.query(`
            SELECT address_id, street, city, postal_code, is_default
            FROM addresses
            WHERE user_id = $1
            ORDER BY is_default DESC, address_id ASC
        `, [user_id]);

        res.json({ addresses: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch addresses' });
    }
});

// POST /api/orders/addresses — add new address
router.post('/addresses', requireAuth, async (req, res) => {
    try {
        const user_id = req.user.user_id;
        const { street, city, postal_code } = req.body;

        if (!street || !city)
            return res.status(400).json({ error: 'Street and city are required' });

        const result = await db.query(`
            INSERT INTO addresses (user_id, street, city, postal_code, is_default)
            VALUES ($1, $2, $3, $4, FALSE)
            RETURNING address_id
        `, [user_id, street, city, postal_code || null]);

        res.status(201).json({ address_id: result.rows[0].address_id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to save address' });
    }
});

// GET /api/orders — get user orders
router.get('/', requireAuth, requireCustomer, async (req, res) => {
    try {
        const user_id = req.user.user_id;
        const result = await db.query(`
            SELECT
                o.order_id, o.total_amount, o.status, o.ordered_at,
                c.code AS coupon_code, c.discount_percent,
                a.street, a.city, a.postal_code,
                p.method AS payment_method, p.status AS payment_status,
                COUNT(oi.item_id) AS item_count
            FROM orders o
            LEFT JOIN coupons c      ON o.coupon_id = c.coupon_id
            JOIN addresses a         ON o.address_id = a.address_id
            LEFT JOIN payments p     ON o.order_id = p.order_id
            LEFT JOIN order_items oi ON o.order_id = oi.order_id
            WHERE o.user_id = $1
            GROUP BY o.order_id, c.code, c.discount_percent,
                     a.street, a.city, a.postal_code,
                     p.method, p.status
            ORDER BY o.ordered_at DESC
        `, [user_id]);

        res.json({ orders: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// GET /api/orders/:id — single order details
router.get('/:id', requireAuth, requireCustomer, async (req, res) => {
    try {
        const user_id = req.user.user_id;
        const { id } = req.params;

        const orderResult = await db.query(`
            SELECT
                o.order_id, o.total_amount, o.status, o.ordered_at,
                c.code AS coupon_code, c.discount_percent,
                a.street, a.city, a.postal_code,
                p.method AS payment_method, p.status AS payment_status, p.paid_at
            FROM orders o
            LEFT JOIN coupons c  ON o.coupon_id = c.coupon_id
            JOIN addresses a     ON o.address_id = a.address_id
            LEFT JOIN payments p ON o.order_id = p.order_id
            WHERE o.order_id = $1 AND o.user_id = $2
        `, [id, user_id]);

        if (orderResult.rows.length === 0)
            return res.status(404).json({ error: 'Order not found' });

        const itemsResult = await db.query(`
            SELECT
                oi.item_id, oi.quantity, oi.unit_price,
                p.product_id, p.name, p.image_url,
                cat.category_name, s.shop_name
            FROM order_items oi
            JOIN products p     ON oi.product_id = p.product_id
            JOIN categories cat ON p.category_id = cat.category_id
            JOIN shops s        ON p.shop_id = s.shop_id
            WHERE oi.order_id = $1
        `, [id]);

        res.json({ order: orderResult.rows[0], items: itemsResult.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch order' });
    }
});

// POST /api/orders — place order
router.post('/', requireAuth, requireCustomer, async (req, res) => {
    try {
        const user_id = req.user.user_id;
        const { address_id, coupon_id, payment_method } = req.body;

        if (!address_id || !payment_method)
            return res.status(400).json({ error: 'Address and payment method are required' });

        // Get cart
        const cartResult = await db.query(`
            SELECT c.product_id, c.quantity, p.price, p.stock, p.is_available, p.name
            FROM cart c
            JOIN products p ON c.product_id = p.product_id
            WHERE c.user_id = $1
        `, [user_id]);

        if (cartResult.rows.length === 0)
            return res.status(400).json({ error: 'Cart is empty' });

        // Validate stock
        for (const item of cartResult.rows) {
            if (!item.is_available)
                return res.status(400).json({ error: `${item.name} is no longer available` });
            if (item.stock < item.quantity)
                return res.status(400).json({ error: `Not enough stock for ${item.name}` });
        }

        // Calculate total
        let total = cartResult.rows.reduce((sum, item) => {
            return sum + (parseFloat(item.price) * item.quantity);
        }, 0);

        // Apply coupon
        let validCouponId = null;
        if (coupon_id) {
            const coupon = await db.query(
                'SELECT * FROM coupons WHERE coupon_id = $1 AND is_active = TRUE AND expiry_date >= NOW()',
                [coupon_id]
            );
            if (coupon.rows.length > 0) {
                const discount = (total * parseFloat(coupon.rows[0].discount_percent)) / 100;
                total -= discount;
                validCouponId = coupon_id;
            }
        }

        // Insert order
        const orderResult = await db.query(`
            INSERT INTO orders (user_id, address_id, coupon_id, total_amount, status)
            VALUES ($1, $2, $3, $4, 'pending')
            RETURNING order_id
        `, [user_id, address_id, validCouponId, total.toFixed(2)]);

        const order_id = orderResult.rows[0].order_id;

        // Insert items + deduct stock
        for (const item of cartResult.rows) {
            await db.query(`
                INSERT INTO order_items (order_id, product_id, quantity, unit_price)
                VALUES ($1, $2, $3, $4)
            `, [order_id, item.product_id, item.quantity, item.price]);

            await db.query(`
                UPDATE products SET stock = stock - $1 WHERE product_id = $2
            `, [item.quantity, item.product_id]);
        }

        // Insert payment
        await db.query(`
            INSERT INTO payments (order_id, method, status, amount)
            VALUES ($1, $2, 'unpaid', $3)
        `, [order_id, payment_method, total.toFixed(2)]);

        // Clear cart
        await db.query('DELETE FROM cart WHERE user_id = $1', [user_id]);

        res.status(201).json({ message: 'Order placed successfully', order_id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to place order' });
    }
});

module.exports = router;