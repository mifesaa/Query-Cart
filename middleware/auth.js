// =============================================
// ECOM — middleware/auth.js
// =============================================

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'querycart_secret_key';

// Verify token — blocks if not logged in
function requireAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Login required' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

// Only sellers allowed
function requireSeller(req, res, next) {
    if (req.user.role !== 'seller') {
        return res.status(403).json({ error: 'Seller access only' });
    }
    next();
}

// Only customers allowed
function requireCustomer(req, res, next) {
    if (req.user.role !== 'customer') {
        return res.status(403).json({ error: 'Customer access only' });
    }
    next();
}

module.exports = { requireAuth, requireSeller, requireCustomer };