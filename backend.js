const mongoose = require('mongoose');
const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const LoggerService = require('./services/LoggerService');
// const AuthService = require('./services/AuthService'); // Optional

const app = express();
app.use(bodyParser.json());

const PORT = 3000;

// MongoDB Connection
const connectDB = async () => {
    try {
       await mongoose.connect('mongodb://localhost:27017/road_safety_db');

        LoggerService.info('Connected to MongoDB');
    } catch (err) {
        LoggerService.error('MongoDB connection failed: ' + err.message);
        process.exit(1);
    }
};

// Schemas & Models
const roadUserSchema = new mongoose.Schema({
    userId: String,
    username: { type: String, unique: true },
    name: String,
    email: { type: String, unique: true },
    phone: { type: String, match: /^[0-9]{10}$/ },
    password: String,
    registeredAt: { type: Date, default: Date.now }
});

const vehicleSchema = new mongoose.Schema({
    vehicleId: { type: String, unique: true },
    ownerId: String,
    licensePlate: String
});

const trafficViolationSchema = new mongoose.Schema({
    violationId: { type: String, unique: true },
    userId: String,
    type: String,
    fineAmount: Number,
    location: String,
    date: { type: Date, default: Date.now },
    status: { type: String, enum: ['Unpaid', 'Paid'], default: 'Unpaid' }
});

const fineSchema = new mongoose.Schema({
    fineId: { type: String, unique: true },
    userId: String,
    amount: Number,
    status: { type: String, enum: ['Pending', 'Paid'], default: 'Pending' },
    createdAt: { type: Date, default: Date.now }
});

const accidentReportSchema = new mongoose.Schema({
    reportId: { type: String, unique: true },
    userId: String,
    location: String,
    severity: String,
    timestamp: { type: Date, default: Date.now }
});

const RoadUser = mongoose.model('RoadUser', roadUserSchema);
const Vehicle = mongoose.model('Vehicle', vehicleSchema);
const TrafficViolation = mongoose.model('TrafficViolation', trafficViolationSchema);
const Fine = mongoose.model('Fine', fineSchema);
const AccidentReport = mongoose.model('AccidentReport', accidentReportSchema);

// API Routes
app.get('/violations', async (req, res) => {
    try {
        const violations = await TrafficViolation.find();
        res.json(violations);
    } catch (err) {
        LoggerService.error('Get violations failed: ' + err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post('/accident', async (req, res) => {
    try {
        const report = new AccidentReport({
            reportId: `ACC-${Date.now()}`,
            userId: req.body.userId || "USER001",
            location: req.body.location,
            severity: req.body.severity,
            timestamp: new Date()
        });
        await report.save();
        LoggerService.info(`Accident reported by ${report.userId}`);
        res.json({ success: true, reportId: report.reportId });
    } catch (err) {
        LoggerService.error('Accident report failed: ' + err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post('/pay-fine', async (req, res) => {
    try {
        const fineId = req.body.fine_id;
        await Fine.updateOne({ fineId }, { status: 'Paid' });
        await TrafficViolation.updateOne({ violationId: fineId }, { status: 'Paid' });
        LoggerService.info(`Fine paid: ${fineId}`);
        res.json({ success: true });
    } catch (err) {
        LoggerService.error('Fine payment failed: ' + err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post('/register', async (req, res) => {
    try {
        const { username, name, email, phone, password } = req.body;
        const userCount = await RoadUser.countDocuments();
        const userId = `USER${String(userCount + 1).padStart(3, '0')}`;

        const existingUser = await RoadUser.findOne({ $or: [{ username }, { email }] });
        if (existingUser) {
            LoggerService.info(`Register conflict: ${username} or ${email}`);
            return res.status(400).json({ success: false, error: "Username or email already exists" });
        }

        const newUser = new RoadUser({
            userId,
            username,
            name,
            email,
            phone,
            password, // Optionally use: AuthService.hashPassword(password)
            registeredAt: new Date()
        });

        await newUser.save();
        LoggerService.info(`User registered: ${username}`);
        res.json({ success: true });
    } catch (err) {
        LoggerService.error('User registration failed: ' + err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await RoadUser.findOne({ username });

        // if (user && AuthService.comparePassword(password, user.password)) {
        if (user && user.password === password) {
            LoggerService.info(`User logged in: ${username}`);
            res.json({ success: true, name: user.name });
        } else {
            LoggerService.info(`Login failed for: ${username}`);
            res.status(401).json({ success: false, error: "Invalid username or password" });
        }
    } catch (err) {
        LoggerService.error('Login failed: ' + err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Seed Data
const seedData = async () => {
    try {
        const users = await RoadUser.find();
        if (users.length === 0) {
            await RoadUser.insertMany([
                { userId: "USER001", username: "johndoe", name: "John Doe", email: "john.doe@example.com", phone: "9876543210", password: "password123" },
                { userId: "USER002", username: "janesmith", name: "Jane Smith", email: "jane.smith@example.com", phone: "8765432109", password: "password123" }
            ]);
            LoggerService.info('Sample users seeded');
        }

        const violations = await TrafficViolation.find();
        if (violations.length === 0) {
            await TrafficViolation.insertMany([
                { violationId: "V001", userId: "USER001", type: "Speeding", fineAmount: 150, location: "Main Street", date: new Date(), status: "Unpaid" },
                { violationId: "V002", userId: "USER001", type: "Parking", fineAmount: 75, location: "Downtown", date: new Date(), status: "Paid" }
            ]);
            LoggerService.info('Sample violations seeded');
        }

        const fines = await Fine.find();
        if (fines.length === 0) {
            await Fine.insertMany([
                { fineId: "V001", userId: "USER001", amount: 150, status: "Pending" },
                { fineId: "V002", userId: "USER001", amount: 75, status: "Paid" }
            ]);
            LoggerService.info('Sample fines seeded');
        }
    } catch (err) {
        LoggerService.error('Seeding failed: ' + err.message);
    }
};

connectDB().then(() => {
    seedData();
    app.listen(PORT, () => LoggerService.info(`Server running on port ${PORT}`));
});
