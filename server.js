const express = require('express');
const cors = require('cors');
const path = require('path');
const { connectDB, seedData, getViolations, submitAccident, payFine, registerUser, loginUser } = require('./backend');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Connect to MongoDB
connectDB();

// Serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API Routes
app.get('/backend/get_violations.php', getViolations);
app.post('/backend/submit_accident.php', submitAccident);
app.post('/backend/pay_fine.php', payFine);
app.post('/backend/register.php', registerUser); // New registration route
app.post('/backend/login.php', loginUser); // New login route

// Start the Server and Seed Data
app.listen(port, async () => {
    console.log(`Server running on http://localhost:${port}`);
    await seedData();
});