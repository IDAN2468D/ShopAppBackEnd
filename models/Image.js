const mongoose = require('mongoose');

const ImageSchema = mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    originalUrl: {
      type: String,
      required: true,
    },
    variants: {
      thumbnail: { type: String }, // 300px
      small: { type: String },     // 600px
      medium: { type: String },    // 1200px
      large: { type: String },     // 1920px
      original: { type: String },  // Original size
    },
    metadata: [
      {
        key: { type: String, required: true },
        value: { type: String, required: true },
      },
    ],
    dimensions: {
      width: { type: Number },
      height: { type: Number },
    },
    fileSize: {
      type: Number, // in bytes
    },
    mimeType: {
      type: String,
    },
    processingStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

ImageSchema.index({ productId: 1 });
ImageSchema.index({ 'metadata.key': 1, 'metadata.value': 1 });

module.exports = mongoose.model('Image', ImageSchema);
