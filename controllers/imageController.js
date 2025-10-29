const Image = require('../models/Image');
const { imageQueue } = require('../middleware/queue');
const { uploadToCloudinary, deleteFromCloudinary } = require('../utils/cloudinaryUtils');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// @desc    Upload single image
// @route   POST /api/images/upload
// @access  Private
const uploadImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'יש לבחור קובץ להעלאה.' }); // No file selected
    }

    const { productId, metadata } = req.body;

    // Create a pending image record
    const image = new Image({
      productId,
      originalUrl: 'pending', // Will be updated after processing
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      processingStatus: 'pending',
      metadata: metadata ? JSON.parse(metadata) : [],
    });

    await image.save();

    // Add image to queue for background processing
    await imageQueue.add('processImage', {
      imageId: image._id,
      fileBuffer: req.file.buffer,
      mimetype: req.file.mimetype,
    });

    res.status(202).json({
      message: 'התמונה הועלתה בהצלחה ותעובד ברקע.',
      image: { _id: image._id, productId: image.productId, processingStatus: image.processingStatus },
    });
  } catch (error) {
    console.error('שגיאה בהעלאת תמונה בודדת:', error);
    next(error);
  }
};

// @desc    Upload multiple images
// @route   POST /api/images/upload-multiple
// @access  Private
const uploadMultipleImages = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'יש לבחור קבצים להעלאה.' }); // No files selected
    }

    const { productId, metadata } = req.body;
    const images = [];

    for (const file of req.files) {
      const image = new Image({
        productId,
        originalUrl: 'pending',
        fileSize: file.size,
        mimeType: file.mimetype,
        processingStatus: 'pending',
        metadata: metadata ? JSON.parse(metadata) : [],
      });
      await image.save();

      await imageQueue.add('processImage', {
        imageId: image._id,
        fileBuffer: file.buffer,
        mimetype: file.mimetype,
      });
      images.push({ _id: image._id, productId: image.productId, processingStatus: image.processingStatus });
    }

    res.status(202).json({
      message: 'התמונות הועלו בהצלחה ויעובדו ברקע.',
      images,
    });
  } catch (error) {
    console.error('שגיאה בהעלאת מספר תמונות:', error);
    next(error);
  }
};

// @desc    Get all images for a product
// @route   GET /api/images/product/:productId
// @access  Public
const getProductImages = async (req, res, next) => {
  try {
    const images = await Image.find({ productId: req.params.productId });
    if (!images || images.length === 0) {
      return res.status(404).json({ message: 'לא נמצאו תמונות עבור מוצר זה.' });
    }
    res.json(images);
  } catch (error) {
    console.error('שגיאה באחזור תמונות מוצר:', error);
    next(error);
  }
};

// @desc    Get single image details
// @route   GET /api/images/:imageId
// @access  Public
const getImageDetails = async (req, res, next) => {
  try {
    const image = await Image.findById(req.params.imageId);
    if (!image) {
      return res.status(404).json({ message: 'תמונה לא נמצאה.' });
    }
    res.json(image);
  } catch (error) {
    console.error('שגיאה באחזור פרטי תמונה:', error);
    next(error);
  }
};

// @desc    Delete image from Cloudinary and database
// @route   DELETE /api/images/:imageId
// @access  Private
const deleteImage = async (req, res, next) => {
  try {
    const image = await Image.findById(req.params.imageId);
    if (!image) {
      return res.status(404).json({ message: 'תמונה לא נמצאה.' });
    }

    // Delete from Cloudinary
    const publicIds = [];
    if (image.originalUrl) publicIds.push(image.originalUrl.split('/').pop().split('.')[0]);
    for (const variant in image.variants) {
      if (image.variants[variant]) {
        publicIds.push(image.variants[variant].split('/').pop().split('.')[0]);
      }
    }

    await deleteFromCloudinary(publicIds);

    await image.remove();

    res.json({ message: 'התמונה נמחקה בהצלחה.' });
  } catch (error) {
    console.error('שגיאה במחיקת תמונה:', error);
    next(error);
  }
};

// @desc    Update image metadata
// @route   PATCH /api/images/:imageId/metadata
// @access  Private
const updateImageMetadata = async (req, res, next) => {
  try {
    const image = await Image.findById(req.params.imageId);
    if (!image) {
      return res.status(404).json({ message: 'תמונה לא נמצאה.' });
    }

    const { metadata } = req.body;

    if (metadata) {
      image.metadata = metadata;
    }

    const updatedImage = await image.save();
    res.json({ message: 'מטא נתונים עודכנו בהצלחה.', image: updatedImage });
  } catch (error) {
    console.error('שגיאה בעדכון מטא נתונים:', error);
    next(error);
  }
};

module.exports = {
  uploadImage,
  uploadMultipleImages,
  getProductImages,
  getImageDetails,
  deleteImage,
  updateImageMetadata,
};
