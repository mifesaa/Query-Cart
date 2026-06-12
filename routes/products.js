// =============================================
// Query Cart — routes/products.js
// =============================================

const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/products/categories
router.get('/categories', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT
                c.category_id,
                c.category_name,
                c.description,
                COUNT(p.product_id) AS product_count
            FROM categories c
            LEFT JOIN products p
                ON c.category_id = p.category_id
                AND p.is_available = TRUE
            GROUP BY c.category_id
            ORDER BY c.category_name
        `);
        res.json({ categories: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

// GET /api/products?limit=40&category=1&search=keyword&minPrice=100&maxPrice=5000&sort=newest
router.get('/', async (req, res) => {
    try {
        const { limit = 40, category, search, minPrice, maxPrice, sort = 'newest' } = req.query;

        let conditions = ['p.is_available = TRUE', 's.is_active = TRUE'];
        const params = [];

        if (category) {
            params.push(category);
            conditions.push(`p.category_id = $${params.length}`);
        }

        if (search) {
            params.push(`%${search}%`);
            conditions.push(`(p.name ILIKE $${params.length} OR p.description ILIKE $${params.length})`);
        }

        if (minPrice) {
            params.push(minPrice);
            conditions.push(`p.price >= $${params.length}`);
        }

        if (maxPrice) {
            params.push(maxPrice);
            conditions.push(`p.price <= $${params.length}`);
        }

        const whereClause = 'WHERE ' + conditions.join(' AND ');

        let orderClause;
        switch (sort) {
            case 'price_asc':  orderClause = 'p.price ASC';  break;
            case 'price_desc': orderClause = 'p.price DESC'; break;
            case 'rating':     orderClause = 'avg_rating DESC NULLS LAST'; break;
            default:           orderClause = 'p.created_at DESC';
        }

        params.push(limit);
        const limitParam = `$${params.length}`;

        const query = `
            SELECT
                p.product_id,
                p.name,
                p.description,
                p.price,
                p.stock,
                p.is_available,
                c.category_name,
                s.shop_name,
                ROUND(AVG(r.rating), 1) AS avg_rating,
                COUNT(r.review_id)      AS review_count
            FROM products p
            JOIN categories c ON p.category_id = c.category_id
            JOIN shops s      ON p.shop_id = s.shop_id
            LEFT JOIN reviews r ON p.product_id = r.product_id
            ${whereClause}
            GROUP BY p.product_id, c.category_name, s.shop_name
            ORDER BY ${orderClause}
            LIMIT ${limitParam}
        `;

        const result = await db.query(query, params);
        res.json({ products: result.rows });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// GET /api/products/:id
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const productResult = await db.query(`
            SELECT
                p.product_id, p.name, p.description,
                p.price, p.stock, p.is_available, p.created_at,
                p.category_id,
                c.category_name,
                s.shop_id, s.shop_name, s.rating AS shop_rating, s.description AS shop_description,
                ROUND(AVG(r.rating), 1) AS avg_rating,
                COUNT(r.review_id)      AS review_count
            FROM products p
            JOIN categories c ON p.category_id = c.category_id
            JOIN shops s      ON p.shop_id = s.shop_id
            LEFT JOIN reviews r ON p.product_id = r.product_id
            WHERE p.product_id = $1
            GROUP BY p.product_id, c.category_name, s.shop_id, s.shop_name, s.rating, s.description
        `, [id]);

        if (productResult.rows.length === 0)
            return res.status(404).json({ error: 'Product not found' });

        const reviewsResult = await db.query(`
            SELECT
                r.rating, r.comment, r.reviewed_at,
                u.name AS reviewer_name
            FROM reviews r
            JOIN users u ON r.user_id = u.user_id
            WHERE r.product_id = $1
            ORDER BY r.reviewed_at DESC
        `, [id]);

        const relatedResult = await db.query(`
            SELECT
                p.product_id, p.name, p.price,
                c.category_name,
                s.shop_name,
                ROUND(AVG(r.rating), 1) AS avg_rating
            FROM products p
            JOIN categories c ON p.category_id = c.category_id
            JOIN shops s      ON p.shop_id = s.shop_id
            LEFT JOIN reviews r ON p.product_id = r.product_id
            WHERE p.category_id = (
                SELECT category_id FROM products WHERE product_id = $1
            )
            AND p.product_id != $1
            AND p.is_available = TRUE
            GROUP BY p.product_id, c.category_name, s.shop_name
            LIMIT 4
        `, [id]);

        res.json({
            product: productResult.rows[0],
            reviews: reviewsResult.rows,
            related: relatedResult.rows
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch product' });
    }
});

module.exports = router;

// POST /api/products/review
const { requireAuth, requireCustomer } = require('../middleware/auth');

router.post('/review', requireAuth, requireCustomer, async (req, res) => {
    try {
        const { product_id, rating, comment } = req.body;
        const user_id = req.user.user_id;

        if (!product_id || !rating) {
            return res.status(400).json({ error: 'Product and rating are required' });
        }

        if (rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Rating must be between 1 and 5' });
        }

        // Check if already reviewed
        const existing = await db.query(
            'SELECT review_id FROM reviews WHERE user_id = $1 AND product_id = $2',
            [user_id, product_id]
        );

        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'You have already reviewed this product' });
        }

        await db.query(
            `INSERT INTO reviews (user_id, product_id, rating, comment)
             VALUES ($1, $2, $3, $4)`,
            [user_id, product_id, rating, comment || null]
        );

        res.status(201).json({ message: 'Review submitted successfully' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to submit review' });
    }
});