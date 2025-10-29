const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  importProducts,
  getProducts,
  getProductById,
} = require('../controllers/productController');

router.post('/import', protect, importProducts);
router.get('/', getProducts);
router.get('/:productId', getProductById);

module.exports = router;
