// =============================================
// Query Cart — routes/shops.js
// =============================================

const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/shops?search=keyword&category=1&sort=rating
router.get('/', async (req, res) => {
    try {
        const { search, category, sort = 'rating' } = req.query;

        let conditions = ['s.is_active = TRUE'];
        const params = [];

        if (search) {
            params.push(`%${search}%`);
            conditions.push(`s.shop_name ILIKE $${params.length}`);
        }

        if (category) {
            params.push(category);
            conditions.push(`EXISTS (
                SELECT 1 FROM products p
                WHERE p.shop_id = s.shop_id
                  AND p.category_id = $${params.length}
                  AND p.is_available = TRUE
            )`);
        }

        const whereClause = 'WHERE ' + conditions.join(' AND ');

        let orderClause;
        switch (sort) {
            case 'name_asc':  orderClause = 's.shop_name ASC'; break;
            case 'products':  orderClause = 'product_count DESC'; break;
            default:          orderClause = 's.rating DESC NULLS LAST, s.shop_name ASC';
        }

        const query = `
            SELECT
                s.shop_id, s.shop_name, s.description, s.rating, s.is_active,
                COUNT(p.product_id) AS product_count
            FROM shops s
            LEFT JOIN products p
                ON p.shop_id = s.shop_id AND p.is_available = TRUE
            ${whereClause}
            GROUP BY s.shop_id
            ORDER BY ${orderClause}
        `;

        const result = await db.query(query, params);
        res.json({ shops: result.rows });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch shops' });
    }
});

// GET /api/shops/:id — shop details + products
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const shopResult = await db.query(`
            SELECT
                s.shop_id, s.shop_name, s.description, s.rating, s.is_active, s.created_at,
                u.name AS seller_name,
                COUNT(DISTINCT p.product_id) AS product_count,
                COUNT(DISTINCT r.review_id)  AS review_count
            FROM shops s
            JOIN users u ON s.user_id = u.user_id
            LEFT JOIN products p ON p.shop_id = s.shop_id AND p.is_available = TRUE
            LEFT JOIN reviews r  ON r.product_id = p.product_id
            WHERE s.shop_id = $1
            GROUP BY s.shop_id, u.name
        `, [id]);

        if (shopResult.rows.length === 0)
            return res.status(404).json({ error: 'Shop not found' });

        const productsResult = await db.query(`
            SELECT
                p.product_id, p.name, p.price, p.stock, p.is_available, p.image_url,
                c.category_name,
                ROUND(AVG(r.rating), 1) AS avg_rating,
                COUNT(r.review_id) AS review_count
            FROM products p
            JOIN categories c ON p.category_id = c.category_id
            LEFT JOIN reviews r ON r.product_id = p.product_id
            WHERE p.shop_id = $1 AND p.is_available = TRUE
            GROUP BY p.product_id, c.category_name
            ORDER BY p.created_at DESC
        `, [id]);

        res.json({
            shop: shopResult.rows[0],
            products: productsResult.rows
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch shop details' });
    }
});

module.exports = router;