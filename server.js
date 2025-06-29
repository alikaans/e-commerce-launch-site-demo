const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Create database directory if it doesn't exist
const dbDir = path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir);
}

// Initialize database
const db = new sqlite3.Database(path.join(dbDir, 'subscribers.db'), (err) => {
    if (err) {
        console.error('Database connection error:', err.message);
    } else {
        console.log('Connected to the SQLite database');
    }
});

// Create table if it doesn't exist
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS subscribers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('Table creation error:', err.message);
        } else {
            console.log('Subscribers table created or already exists');
        }
    });
});

// Middleware
app.use(bodyParser.json());
app.use(express.static('public'));

// Serve the HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    // Simple database check
    db.get("SELECT 1", (err) => {
        if (err) {
            console.error('Database health check failed:', err.message);
            res.status(500).json({ status: 'down', error: err.message });
        } else {
            res.json({ status: 'up' });
        }
    });
});

// Subscribe endpoint
app.post('/subscribe', (req, res) => {
    const { email } = req.body;
    
    if (!email || !validateEmail(email)) {
        return res.status(400).json({ error: 'Invalid email address' });
    }
    
    db.run(
        'INSERT INTO subscribers (email) VALUES (?)', 
        [email],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ error: 'Email is already subscribed' });
                }
                return res.status(500).json({ error: 'Database error' });
            }
            
            res.json({ 
                message: "Thank you for subscribing! We'll notify you when we launch.",
                id: this.lastID
            });
        }
    );
});

// Email validation function
function validateEmail(email) {
    const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Database file: ${path.join(dbDir, 'subscribers.db')}`);
});