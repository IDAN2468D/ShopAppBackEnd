const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const Product = require('../models/Product');
const axios = require('axios');
const { processAndUploadImage } = require('../utils/imageProcessingUtils');

async function main() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/shopapp';
  await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to MongoDB:', mongoUri);

  const filePath = path.join(__dirname, '..', 'Product.json');
  if (!fs.existsSync(filePath)) {
    console.error('Product.json not found at', filePath);
    process.exit(1);
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse Product.json:', err.message);
    process.exit(1);
  }

  const products = Array.isArray(data) ? data : data.products || [];
  if (!products.length) {
    console.error('No products found in Product.json');
    process.exit(1);
  }

  let imported = 0;
  for (const p of products) {
    try {
      // Normalize the object to match the Product model
      const doc = {
        productId: p.productId || p.id || p._id || String(Date.now()) + Math.random().toString(36).slice(2, 8),
        name: p.name || p.title || 'Unnamed Product',
        description: p.description || p.desc || '',
        category: p.category || 'uncategorized',
        price: Number(p.price) || 0,
        currency: p.currency || 'USD',
        stock: Number(p.stock) || 0,
        inStock: !!p.inStock || (Number(p.stock) > 0),
        rating: Number(p.rating) || 0,
        reviewsCount: Number(p.reviewsCount) || 0,
        tags: Array.isArray(p.tags) ? p.tags : (p.tags ? [p.tags] : []),
        seller: p.seller || undefined,
        shipping: p.shipping || undefined,
      };

      // If the product JSON contains images, map them into the Product.images structure
      // Support shapes like:
      // 1) images: { main: { original, thumbnail, small, medium, large } }
      // 2) images: { main: 'https://...' }
      // 3) images: { original: '...', thumbnail: '...' } (main omitted)
      // 4) image: 'https://...' (single string)
      if (p.images && typeof p.images === 'object') {
        // prefer p.images.main if present, otherwise treat p.images as the main object
        const mainSource = p.images.main ? p.images.main : p.images;

        if (typeof mainSource === 'string') {
          doc.images = { main: { original: mainSource, thumbnail: mainSource, small: mainSource, medium: mainSource, large: mainSource } };
        } else if (typeof mainSource === 'object') {
          // gather known variant keys if present
          const variants = {};
          const keys = ['original', 'thumbnail', 'small', 'medium', 'large'];
          for (const k of keys) {
            if (mainSource[k] && typeof mainSource[k] === 'string') {
              variants[k] = mainSource[k];
            }
          }
          // if variants found, set images.main to that object
          if (Object.keys(variants).length) {
            doc.images = { main: variants };
          }
        }
      } else if (p.image && typeof p.image === 'string') {
        doc.images = { main: { original: p.image, thumbnail: p.image, small: p.image, medium: p.image, large: p.image } };
      }

      // If an original image URL is present, fetch and upload it to Cloudinary
      if (doc.images && doc.images.main && doc.images.main.original) {
        try {
          console.log(`Fetching image for ${doc.name} from ${doc.images.main.original}`);
          const response = await axios.get(doc.images.main.original, { responseType: 'arraybuffer' });
          const imageBuffer = Buffer.from(response.data);
          const mimetype = response.headers['content-type'];

          // Use a dummy image object as processAndUploadImage expects one, but we don't save it
          const dummyImage = { originalUrl: '', variants: {} };
          const uploadedVariants = await processAndUploadImage(dummyImage, imageBuffer, mimetype);

          doc.images.main = uploadedVariants;
          console.log(`Uploaded image for ${doc.name} to Cloudinary.`);
        } catch (imageErr) {
          console.error(`Failed to fetch or upload image for ${doc.name}:`, imageErr.message);
          // Keep the original URL if upload fails
        }
      }

      // Upsert by productId to avoid duplicates and update image URLs if they were processed
      const res = await Product.findOneAndUpdate(
        { productId: doc.productId },
        { $set: doc }, // Use $set to update all fields, including images
        { upsert: true, new: true }
      );

      imported++;
    } catch (err) {
      console.error('Failed to import product', p && (p.productId || p.name), err.message);
    }
  }

  console.log('Imported or upserted products:', imported);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});