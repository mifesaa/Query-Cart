// =============================================
// Query Cart — routes/cart.js
// =============================================

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireCustomer } = require('../middleware/auth');

// GET /api/cart
router.get('/', requireAuth, requireCustomer, async (req, res) => {
    try {
        const user_id = req.user.user_id;

        const result = await db.query(`
            SELECT
                c.cart_id,
                c.quantity,
                c.added_at,
                p.product_id,
                p.name,
                p.price,
                p.stock,
                p.is_available,
                p.image_url,
                cat.category_name,
                s.shop_name
            FROM cart c
            JOIN products p   ON c.product_id = p.product_id
            JOIN categories cat ON p.category_id = cat.category_id
            JOIN shops s      ON p.shop_id = s.shop_id
            WHERE c.user_id = $1
            ORDER BY c.added_at DESC
        `, [user_id]);

        // Calculate total
        const total = result.rows.reduce((sum, item) => {
            return sum + (parseFloat(item.price) * item.quantity);
        }, 0);

        res.json({ items: result.rows, total: total.toFixed(2) });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch cart' });
    }
});

// POST /api/cart
router.post('/', requireAuth, requireCustomer, async (req, res) => {
    try {
        const user_id = req.user.user_id;
        const { product_id, quantity = 1 } = req.body;

        if (!product_id) {
            return res.status(400).json({ error: 'Product ID required' });
        }

        // Check product exists and is available
        const product = await db.query(
            'SELECT product_id, stock, is_available FROM products WHERE product_id = $1',
            [product_id]
        );

        if (product.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        if (!product.rows[0].is_available) {
            return res.status(400).json({ error: 'Product is not available' });
        }

        if (product.rows[0].stock < quantity) {
            return res.status(400).json({ error: 'Not enough stock' });
        }

        // Upsert — if already in cart, increase quantity
        await db.query(`
            INSERT INTO cart (user_id, product_id, quantity)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, product_id)
            DO UPDATE SET quantity = cart.quantity + $3
        `, [user_id, product_id, quantity]);

        res.status(201).json({ message: 'Added to cart' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to add to cart' });
    }
});

// PATCH /api/cart/:cart_id  — update quantity
router.patch('/:cart_id', requireAuth, requireCustomer, async (req, res) => {
    try {
        const user_id = req.user.user_id;
        const { cart_id } = req.params;
        const { quantity } = req.body;

        if (!quantity || quantity < 1) {
            return res.status(400).json({ error: 'Quantity must be at least 1' });
        }

        // Check stock
        const item = await db.query(`
            SELECT c.cart_id, p.stock
            FROM cart c
            JOIN products p ON c.product_id = p.product_id
            WHERE c.cart_id = $1 AND c.user_id = $2
        `, [cart_id, user_id]);

        if (item.rows.length === 0) {
            return res.status(404).json({ error: 'Cart item not found' });
        }

        if (quantity > item.rows[0].stock) {
            return res.status(400).json({ error: `Only ${item.rows[0].stock} in stock` });
        }

        await db.query(
            'UPDATE cart SET quantity = $1 WHERE cart_id = $2 AND user_id = $3',
            [quantity, cart_id, user_id]
        );

        res.json({ message: 'Cart updated' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update cart' });
    }
});

// DELETE /api/cart/:cart_id — remove item
router.delete('/:cart_id', requireAuth, requireCustomer, async (req, res) => {
    try {
        const user_id = req.user.user_id;
        const { cart_id } = req.params;

        await db.query(
            'DELETE FROM cart WHERE cart_id = $1 AND user_id = $2',
            [cart_id, user_id]
        );

        res.json({ message: 'Item removed from cart' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to remove item' });
    }
});

// DELETE /api/cart — clear entire cart
router.delete('/', requireAuth, requireCustomer, async (req, res) => {
    try {
        const user_id = req.user.user_id;
        await db.query('DELETE FROM cart WHERE user_id = $1', [user_id]);
        res.json({ message: 'Cart cleared' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to clear cart' });
    }
});

// POST /api/cart/wishlist — add to wishlist
router.post('/wishlist', requireAuth, requireCustomer, async (req, res) => {
    try {
        const user_id = req.user.user_id;
        const { product_id } = req.body;

        if (!product_id) {
            return res.status(400).json({ error: 'Product ID required' });
        }

        await db.query(`
            INSERT INTO wishlist (user_id, product_id)
            VALUES ($1, $2)
            ON CONFLICT (user_id, product_id) DO NOTHING
        `, [user_id, product_id]);

        res.status(201).json({ message: 'Added to wishlist' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to add to wishlist' });
    }
});

// GET /api/cart/wishlist
router.get('/wishlist', requireAuth, requireCustomer, async (req, res) => {
    try {
        const user_id = req.user.user_id;

        const result = await db.query(`
            SELECT
                w.wishlist_id,
                w.added_at,
                p.product_id,
                p.name,
                p.price,
                p.stock,
                p.is_available,
                p.image_url,
                cat.category_name,
                s.shop_name
            FROM wishlist w
            JOIN products p     ON w.product_id = p.product_id
            JOIN categories cat ON p.category_id = cat.category_id
            JOIN shops s        ON p.shop_id = s.shop_id
            WHERE w.user_id = $1
            ORDER BY w.added_at DESC
        `, [user_id]);

        res.json({ items: result.rows });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch wishlist' });
    }
});

// DELETE /api/cart/wishlist/:wishlist_id
router.delete('/wishlist/:wishlist_id', requireAuth, requireCustomer, async (req, res) => {
    try {
        const user_id = req.user.user_id;
        const { wishlist_id } = req.params;

        await db.query(
            'DELETE FROM wishlist WHERE wishlist_id = $1 AND user_id = $2',
            [wishlist_id, user_id]
        );

        res.json({ message: 'Removed from wishlist' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to remove from wishlist' });
    }
});

module.exports = router;