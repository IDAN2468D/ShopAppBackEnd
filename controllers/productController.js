const Product = require('../models/Product');

// @desc    Import products from JSON
// @route   POST /api/products/import
// @access  Private (admin only)
const importProducts = async (req, res, next) => {
  try {
    const productsData = req.body.products; // Assuming the JSON has a 'products' array

    if (!productsData || !Array.isArray(productsData) || productsData.length === 0) {
      return res.status(400).json({ message: 'יש לספק מערך מוצרים בפורמט JSON.' });
    }

    const importedProducts = [];
    for (const product of productsData) {
      // Check if product already exists to avoid duplicates
      const existingProduct = await Product.findOne({ productId: product.productId });
      if (existingProduct) {
        console.log(`מוצר עם מזהה ${product.productId} כבר קיים, מדלג.`);
        continue;
      }

      const newProduct = new Product({
        productId: product.productId,
        name: product.name,
        description: product.description,
        category: product.category,
        price: product.price,
        currency: product.currency,
        stock: product.stock,
        inStock: product.inStock,
        rating: product.rating,
        reviewsCount: product.reviewsCount,
        tags: product.tags,
        seller: product.seller,
        shipping: product.shipping,
      });
      await newProduct.save();
      importedProducts.push(newProduct);
    }

    res.status(201).json({
      message: `הוצגו בהצלחה ${importedProducts.length} מוצרים.`, // Successfully imported
      importedCount: importedProducts.length,
      products: importedProducts,
    });
  } catch (error) {
    console.error('שגיאה בייבוא מוצרים:', error);
    next(error);
  }
};

// @desc    Get all products
// @route   GET /api/products
// @access  Public
const getProducts = async (req, res, next) => {
  try {
    const products = await Product.find({});
    res.json(products);
  } catch (error) {
    console.error('שגיאה באחזור מוצרים:', error);
    next(error);
  }
};

// @desc    Get single product by ID
// @route   GET /api/products/:productId
// @access  Public
const getProductById = async (req, res, next) => {
  try {
    const product = await Product.findOne({ productId: req.params.productId });
    if (!product) {
      return res.status(404).json({ message: 'מוצר לא נמצא.' });
    }
    res.json(product);
  } catch (error) {
    console.error('שגיאה באחזור מוצר לפי מזהה:', error);
    next(error);
  }
};

module.exports = {
  importProducts,
  getProducts,
  getProductById,
};
