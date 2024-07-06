const express = require('express');
const mysql = require('mysql2');
const config = require('./config');
const jwt = require('jsonwebtoken');
// const bcrypt = require('bcryptjs');
require('dotenv').config();
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;
const secretKey = process.env.SECRET_KEY; // Replace with your secret key

// Create a MySQL connection pool
const pool = mysql.createPool(config);

// Middleware to parse JSON bodies
app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));

app.get('/api/user', (req, res) => {
    pool.query('SELECT * FROM users', (error, results) => {
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        res.json(results);
    });
});

// Endpoint to add a new user
app.post('/api/user/signup', async (req, res) => {
    const { name, email, contact, password, address, active, admin } = req.body;
    if (!name || !email || !contact || !password || !address || !active || !admin) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        
        const sql = 'INSERT INTO users (name, email, contact, password, address, active, admin) VALUES (?, ?, ?, ?, ?, ?, ?)';
        pool.query(sql, [name, email, contact, password, address, active, admin], (error, results) => {
            if (error) {
                return res.status(500).json({ error: error.message });
            }
            res.status(201).json({ id: results.insertId, name, email, contact, address, active, admin });
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

    const sql = 'SELECT * FROM users WHERE email = ?';
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

        if (!user.active) {
            return res.status(501).json({ error: 'User is not active' });
        }

        try {
            if (user.active && !user.admin) {
                const updatedVisites = user.visites + 1;
                const updateSql = 'UPDATE users SET visites = ? WHERE email = ?';
                pool.query(updateSql, [updatedVisites, email], (error, results) => {
                    if (error) {
                        return res.status(500).json({ error: error.message });
                    }
                    const token = jwt.sign({ id: user.id, email: user.email }, secretKey, { expiresIn: '1h' });
                    console.log('Generated token:', token); // Log the generated token
                    res.status(200).json({ token, visites: updatedVisites });
                });
            } else if (user.admin && user.active) {
                const updatedVisites = user.visites + 1;
                const updateSql = 'UPDATE users SET visites = ? WHERE email = ?';
                pool.query(updateSql, [updatedVisites, email], (error, results) => {
                    if (error) {
                        return res.status(500).json({ error: error.message });
                    }
                    const token = jwt.sign({ id: user.id, email: user.email }, secretKey, { expiresIn: '1h' });
                    console.log('Generated token:', token); // Log the generated token
                    res.status(201).json({ token, visites: updatedVisites });
                });
            }
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
    const sql = 'SELECT id, name, email, contact, address, active FROM users WHERE id = ?';
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

app.get('/api/ordersAdmin', (req, res) => {
    pool.query('SELECT * FROM orders', (error, results) => {
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        res.json(results);
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

app.get('/api/get-submit-contact', (req, res) => {
    let sql = 'SELECT * FROM contacts';
    pool.query(sql, (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});


// Endpoint to delete a product
app.delete('/api/product/delete/:id', (req, res) => {
    const { id } = req.params;
    const sql = 'DELETE FROM products WHERE id = ?';
    pool.query(sql, [id], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (results.affectedRows === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json({ message: 'Product deleted successfully' });
    });
});

// Endpoint to update a product
app.put('/api/product/update/:id', (req, res) => {
    const { id } = req.params;
    const { name, price, rating, image } = req.body;
    const sql = 'UPDATE products SET name = ?, price = ?, rating = ?, image = ? WHERE id = ?';
    pool.query(sql, [name, price, rating, image, id], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (results.affectedRows === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json({ message: 'Product updated successfully' });
    });
});

// Endpoint to update a user
app.put('/api/user/update/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { name, email, contact, address, active } = req.body;
    const sql = 'UPDATE users SET name = ?, email = ?, contact = ?, address = ?, active = ? WHERE id = ?';
    pool.query(sql, [name, email, contact, address, active, id], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (results.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ message: 'User updated successfully' });
    });
});


// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
