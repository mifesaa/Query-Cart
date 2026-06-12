const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Serve uploaded product images
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Routes
const authRoutes    = require('./routes/auth');
const productRoutes = require('./routes/products');
const cartRoutes    = require('./routes/cart');
const orderRoutes   = require('./routes/orders');
const sellerRoutes  = require('./routes/seller');

app.use('/api/auth',     authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart',     cartRoutes);
app.use('/api/orders',   orderRoutes);
app.use('/api/seller',   sellerRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});