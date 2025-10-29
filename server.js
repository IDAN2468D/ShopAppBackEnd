const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const cloudinaryConfig = require('./config/cloudinary');
const imageRoutes = require('./routes/imageRoutes');
const productRoutes = require('./routes/productRoutes');
const userRoutes = require('./routes/userRoutes');
const { setupQueue } = require('./middleware/queue');
const errorHandler = require('./middleware/errorHandler');
const rateLimit = require('express-rate-limit');

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

// Configure Cloudinary
cloudinaryConfig();

const app = express();

// Enable CORS
app.use(cors());

// Rate limiting for upload endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Max 100 requests per 15 minutes
  message: 'Too many requests from this IP, please try again after 15 minutes',
});

app.use('/api/images/upload', apiLimiter);
app.use('/api/images/upload-multiple', apiLimiter);

// Middleware
app.use(express.json());

// Routes
app.use('/api/images', imageRoutes);
app.use('/api/products', productRoutes);
app.use('/api/users', userRoutes);

// Error handling middleware
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Setup Bull Queue
  setupQueue();
});
