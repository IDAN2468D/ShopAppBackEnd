const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { upload } = require('../middleware/uploadMiddleware');
const {
  uploadImage,
  uploadMultipleImages,
  getProductImages,
  getImageDetails,
  deleteImage,
  updateImageMetadata,
} = require('../controllers/imageController');

router.post('/upload', protect, upload.single('image'), uploadImage);
router.post('/upload-multiple', protect, upload.array('images', 10), uploadMultipleImages);
router.get('/product/:productId', getProductImages);
router.get('/:imageId', getImageDetails);
router.delete('/:imageId', protect, deleteImage);
router.patch('/:imageId/metadata', protect, updateImageMetadata);

module.exports = router;
