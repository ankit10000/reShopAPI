const express = require('express');
const mysql = require('mysql2');
const config = require('./config');
const jwt = require('jsonwebtoken');
// const bcrypt = require('bcryptjs');
const cors = require('cors');
const app = express();
const port = 3306;
const secretKey = 'helloiamankit'; // Replace with your secret key

// Create a MySQL connection pool
const pool = mysql.createPool(config);

// Middleware to parse JSON bodies
app.use(express.json());
app.use(cors());
// Endpoint to get all users
app.get('/api/user', (req, res) => {
    pool.query('SELECT * FROM user', (error, results) => {
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        res.json(results);
    });
});

// Endpoint to add a new user
app.post('/api/user/signup', async (req, res) => {
    const { name, email, contact, password, address, active } = req.body;
    if (!name || !email || !contact || !password || !address || !active) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        
        const sql = 'INSERT INTO user (name, email, contact, password, address, active) VALUES (?, ?, ?, ?, ?, ?)';
        pool.query(sql, [name, email, contact, password, address, active], (error, results) => {
            if (error) {
                return res.status(500).json({ error: error.message });
            }
            res.status(201).json({ id: results.insertId, name, email, contact, address, active });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/user/login', (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    const sql = 'SELECT * FROM user WHERE email = ?';
    pool.query(sql, [email], async (error, results) => {
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        if (results.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const user = results[0];
        console.log('Database result:', user); // Log the database result

        if (!user.password) {
            return res.status(500).json({ error: 'Password field is missing for the user' });
        }

        try {
            const token = jwt.sign({ id: user.id, email: user.email }, secretKey, { expiresIn: '1h' });
            console.log('Generated token:', token); // Log the generated token
            res.json({ token });
        } catch (compareError) {
            return res.status(500).json({ error: compareError.message });
        }
    });
});



// Middleware to verify token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.sendStatus(401);
    }
    jwt.verify(token, secretKey, (err, user) => {
        if (err) {
            return res.sendStatus(403);
        }
        req.user = user;
        next();
    });
};

// Endpoint to fetch user details
app.get('/api/user-details', authenticateToken, (req, res) => {
    const sql = 'SELECT id, name, email, contact, address, active FROM user WHERE id = ?';
    pool.query(sql, [req.user.id], (error, results) => {
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        res.json(results[0]);
    });
});
app.post('/api/order', authenticateToken, (req, res) => {
    const { items, address, paymentMethod } = req.body;

    if (!items || !address || !paymentMethod) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    const sql = 'INSERT INTO orders (user_id, items, address, payment_method) VALUES (?, ?, ?, ?)';
    const itemsStr = JSON.stringify(items); // Store items as a JSON string

    pool.query(sql, [req.user.id, itemsStr, address, paymentMethod], (error, results) => {
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        res.status(201).json({ orderId: results.insertId });
    });
});

// Endpoint to get all orders for a specific user
app.get('/api/orders', authenticateToken, (req, res) => {
    const sql = 'SELECT * FROM orders WHERE user_id = ?';
    pool.query(sql, [req.user.id], (error, results) => {
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        res.json(results.map(order => ({
            id: order.order_id,
            items: JSON.parse(order.items),
            address: order.address,
            paymentMethod: order.payment_method,
            createdAt: order.created_at
        })));
    });
});


app.post('/api/product/addproduct', (req, res) => {
    let product = {name: req.body.name, price: req.body.price, rating: req.body.rating, image: req.body.image};
    let sql = 'INSERT INTO products SET ?';
    pool.query(sql, product, (err, result) => {
        if (err) throw err;
        res.send('Product added...');
    });
});

// Get Products
app.get('/api/product/getproducts', (req, res) => {
    let sql = 'SELECT * FROM products';
    pool.query(sql, (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});


app.post('/api/submit-contact', (req, res) => {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
        return res.status(400).send('All fields are required');
    }

    const query = 'INSERT INTO contacts (name, email, message) VALUES (?, ?, ?)';
    pool.query(query, [name, email, message], (err) => {
        if (err) {
            return res.status(500).send('Database error');
        }
        res.status(200).send('Form submitted successfully');
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://https://red-shop.azurewebsites.net/:${port}`);
});
