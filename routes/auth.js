// =============================================
// Query Cart — routes/auth.js
// =============================================

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'querycart_secret_key';

// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, phone, role } = req.body;

        if (!name || !email || !password || !phone || !role) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        if (!['customer', 'seller'].includes(role)) {
            return res.status(400).json({ error: 'Role must be customer or seller' });
        }

        const existing = await db.query(
            'SELECT user_id FROM users WHERE email = $1 OR phone = $2',
            [email, phone]
        );

        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'Email or phone already registered' });
        }

        const hashed = await bcrypt.hash(password, 10);

        const result = await db.query(
            `INSERT INTO users (name, email, password, phone, role)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING user_id, name, email, phone, role, created_at`,
            [name, email, hashed, phone, role]
        );

        const user = result.rows[0];

        // NOTE: Sellers no longer get an auto-created shop.
        // They create their shop manually from Shop Settings.

        const token = jwt.sign(
            { user_id: user.user_id, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({ user: { ...user, shop_id: null }, token });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const result = await db.query(
            `SELECT user_id, name, email, phone, password, role, is_active
             FROM users WHERE email = $1`,
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const user = result.rows[0];

        if (!user.is_active) {
            return res.status(403).json({ error: 'Account is deactivated' });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Get shop_id if seller (may be null if shop not created yet)
        let shop_id = null;
        if (user.role === 'seller') {
            const shop = await db.query(
                'SELECT shop_id FROM shops WHERE user_id = $1',
                [user.user_id]
            );
            if (shop.rows.length > 0) shop_id = shop.rows[0].shop_id;
        }

        const token = jwt.sign(
            { user_id: user.user_id, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        const { password: _, ...userSafe } = user;
        res.json({ user: { ...userSafe, shop_id }, token });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Login failed' });
    }
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'No token' });

        const decoded = jwt.verify(token, JWT_SECRET);

        const result = await db.query(
            `SELECT user_id, name, email, phone, role, is_active, created_at
             FROM users WHERE user_id = $1`,
            [decoded.user_id]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

        res.json({ user: result.rows[0] });
    } catch (err) {
        res.status(401).json({ error: 'Invalid token' });
    }
});

router.put('/profile', requireAuth, async (req, res) => {
    try {
        const { name, phone } = req.body;
        const user_id = req.user.user_id;
 
        if (!name || !phone) {
            return res.status(400).json({ error: 'Name and phone are required' });
        }
 
        // Check phone not taken by another user
        const existing = await db.query(
            'SELECT user_id FROM users WHERE phone = $1 AND user_id != $2',
            [phone, user_id]
        );
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'Phone number already in use' });
        }
 
        await db.query(
            'UPDATE users SET name = $1, phone = $2 WHERE user_id = $3',
            [name, phone, user_id]
        );
 
        res.json({ message: 'Profile updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});
 
// PUT /api/auth/password — change password
router.put('/password', requireAuth, async (req, res) => {
    try {
        const { current_password, new_password } = req.body;
        const user_id = req.user.user_id;
 
        if (!current_password || !new_password) {
            return res.status(400).json({ error: 'Both current and new password are required' });
        }
 
        if (new_password.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters' });
        }
 
        const result = await db.query('SELECT password FROM users WHERE user_id = $1', [user_id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
 
        const match = await bcrypt.compare(current_password, result.rows[0].password);
        if (!match) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }
 
        const hashed = await bcrypt.hash(new_password, 10);
        await db.query('UPDATE users SET password = $1 WHERE user_id = $2', [hashed, user_id]);
 
        res.json({ message: 'Password updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update password' });
    }
});

module.exports = router;