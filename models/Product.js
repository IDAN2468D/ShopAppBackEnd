const mongoose = require('mongoose');

const SellerSchema = new mongoose.Schema({
  sellerId: { type: String, required: true },
  name: { type: String, required: true },
  rating: { type: Number, default: 0 },
});

const ShippingSchema = new mongoose.Schema({
  freeShipping: { type: Boolean, default: false },
  estimatedDays: { type: Number },
});

const ImageUrlsSchema = new mongoose.Schema({
  original: { type: String },
  thumbnail: { type: String },
  small: { type: String },
  medium: { type: String },
  large: { type: String },
});

const ProductSchema = new mongoose.Schema(
  {
    productId: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      required: true,
    },
    stock: {
      type: Number,
      required: true,
      default: 0,
    },
    inStock: {
      type: Boolean,
      required: true,
      default: false,
    },
    rating: {
      type: Number,
      default: 0,
    },
    reviewsCount: {
      type: Number,
      default: 0,
    },
    // images.main will store the original image URL (imported)
    // images.variants will be populated by the image processing worker (thumbnail/small/...)
    images: {
      main: ImageUrlsSchema,
    },
    tags: [
      {
        type: String,
      },
    ],
    seller: SellerSchema,
    shipping: ShippingSchema,
  },
  { timestamps: true }
);

ProductSchema.index({ category: 1 });
ProductSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Product', ProductSchema);
