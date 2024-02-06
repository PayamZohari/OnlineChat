const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');  // Add this line
const fs = require('fs');    // Add this line


const app = express();
const PORT = process.env.PORT || 3000;


// MySQL setup
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root', // Change this to your MySQL username
  password: 'payam1380', // Change this to your MySQL password
  database: 'mydb',
});

// Express middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ secret: 'your-secret-key', resave: true, saveUninitialized: true }));
app.use(express.static(__dirname + '/views'));

// Routes
app.get('/', (req, res) => {
  if (req.session.userId) {
    res.sendFile(__dirname + '/views/home.html');
  } else {
    res.sendFile(__dirname + '/views/login.html');
  }
});


app.get('/register', (req, res) => {
  res.sendFile(__dirname + '/views/register.html');
});

app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    connection.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], (err, results) => {
      if (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
      } else {
        res.redirect('/');
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  connection.query('SELECT * FROM users WHERE username = ?', [username], async (err, results) => {
    if (err) {
      console.error(err);
      res.status(500).send('Internal Server Error');
    } else if (results.length > 0 && await bcrypt.compare(password, results[0].password)) {
      req.session.userId = results[0].id;
      res.redirect('/');
    } else {
      res.send('Invalid login credentials');
    }
  });
});

app.get('/user-list', (req, res) => {
    const userId = req.session.userId;
  
    if (!userId) {
      return res.status(403).send('Forbidden');
    }
  
    // Retrieve the list of distinct users the current user has interacted with
    const userListQuery = `
      SELECT DISTINCT u.username
      FROM users u
      LEFT JOIN messages m ON u.id = m.sender_id OR u.id = m.receiver_id
      WHERE m.sender_id = ? OR m.receiver_id = ?
    `;
  
    connection.query(userListQuery, [userId, userId], (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Internal Server Error');
      }
  
      const users = results.map(result => ({ username: result.username }));
      res.json(users);
    });
  });

  app.get('/send-message/:username', (req, res) => {
    const recipientUsername = req.params.username;
    const filePath = path.join(__dirname, '/views/send-message.html');
  
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Internal Server Error');
      }
  
      // Replace placeholders in the HTML file with actual data
      const htmlContent = data.replace(/{{recipientUsername}}/g, recipientUsername);
  
      // Send the modified HTML content
      res.send(htmlContent);
    });
  });
  
  app.get('/chat-history/:username', (req, res) => {
    const userId = req.session.userId;
  
    if (!userId) {
      return res.status(403).send('Forbidden');
    }
  
    const recipientUsername = req.params.username;
  
    // Fetch chat history from the database for the specified user
    const chatHistoryQuery = `
      SELECT u.username AS sender, m.content
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE (m.sender_id = ? AND m.receiver_id = (SELECT id FROM users WHERE username = ?))
         OR (m.sender_id = (SELECT id FROM users WHERE username = ?) AND m.receiver_id = ?)
      ORDER BY m.timestamp;
    `;
  
    connection.query(chatHistoryQuery, [userId, recipientUsername, recipientUsername, userId], (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Internal Server Error');
      }
  
      const chatHistory = results.map(result => ({ sender: result.sender, content: result.content }));
      res.json(chatHistory);
    });
  });
  
  
 
app.get('/send-message', (req, res) => {
    const recipientUsername = req.query.recipient || '';
    res.sendFile(__dirname + '/views/send-message.html');
  });
  
  app.post('/send-message', (req, res) => {
    // Extract the recipient username and message text from the form submission
    const { 'recipient-username': recipientUsername, 'message-text': messageText } = req.body || {};
  
    // Check if recipientUsername is defined
    if (!recipientUsername) {
      return res.status(400).send('Invalid request, missing recipientUsername');
    }
  
    // Retrieve the user ID of the sender
    const senderId = req.session.userId;
  
    if (!senderId) {
      return res.status(403).send('Forbidden');
    }
  
    // Retrieve the user ID of the receiver based on the provided username
    const receiverQuery = 'SELECT id FROM users WHERE LOWER(username) = LOWER(?)';
    connection.query(receiverQuery, [recipientUsername.trim()], (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Internal Server Error');
      }
  
      if (results.length > 0) {
        const receiverId = results[0].id;
  
        // Implement the logic to save the message in the database
        const insertMessageQuery = 'INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)';
        connection.query(insertMessageQuery, [senderId, receiverId, messageText], (err) => {
          if (err) {
            console.error(err);
            return res.status(500).send('Internal Server Error');
          }
  
          // Redirect back to the home page after sending the message
          res.redirect('/');
        });
      } else {
        // User with the provided username not found
        res.status(404).send('User not found');
      }
    });
  });
  
  
  
  app.get('/login', (req, res) => {
    res.sendFile(__dirname + '/views/login.html');
  });

  // Add this route for logout
app.post('/logout', (req, res) => {
  // Destroy the session
  req.session.destroy(err => {
    if (err) {
      console.error(err);
      res.status(500).send('Internal Server Error');
    } else {
      // Redirect to the login page after logout
      res.redirect('/login');
    }
  });
});
  
  
  


app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
