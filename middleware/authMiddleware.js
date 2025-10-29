const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Assuming a User model exists for authentication

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Attach user to the request (assuming a User model with findById)
      req.user = await User.findById(decoded.id).select('-password');

      next();
    } catch (error) {
      console.error('שגיאת אימות טוקן:', error);
      res.status(401).json({ message: 'לא מורשה, טוקן נכשל.' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'לא מורשה, אין טוקן.' });
  }
};

module.exports = { protect };
