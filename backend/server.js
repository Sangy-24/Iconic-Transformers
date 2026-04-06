import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import axios from 'axios'; // Added for communicating with FastAPI

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/nexusai';
const ML_SERVICE_URL = "http://127.0.0.1:8000"; // URL where your Python FastAPI is running

// Basic Auth Middleware
const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).send('Access Denied');
  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).send('Invalid Token');
  }
};

// Admin Middleware
const adminMiddleware = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).send('Admin access required');
  }
};

// --- NEW CHATBOT ROUTE ---
app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;
    
    // Forward the message to the FastAPI /chatbot endpoint
    const response = await axios.post(`${ML_SERVICE_URL}/chatbot`, {
      query: message
    });

    res.json({ response: response.data.response });
  } catch (error) {
    console.error("Chatbot Error:", error.message);
    res.status(500).json({ response: "The AI service is currently unavailable." });
  }
});

// Connect DB
mongoose.connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.log('Failed to connect to MongoDB', err));

app.get('/', (req, res) => {
  res.send('Iconic Transformers API running...');
});

app.listen(PORT, () => console.log(`Backend server running on port ${PORT}`));