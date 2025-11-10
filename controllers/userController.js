const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const axios = require('axios');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

// @desc    Register new user
// @route   POST /api/users/register
// @access  Public
const registerUser = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'אנא הכנס את כל השדות הנדרשים.' });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'משתמש כבר קיים.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error('שגיאה ברישום משתמש:', error);
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/users/login
// @access  Public
const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (user && (await bcrypt.compare(password, user.password))) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        token: generateToken(user._id),
      });
    } else {
      res.status(400).json({ message: 'פרטי התחברות לא חוקיים.' });
    }
  } catch (error) {
    console.error('שגיאה בהתחברות משתמש:', error);
    next(error);
  }
};

// @desc    Forgot password using MailerSend API
// @route   POST /api/users/forgotpassword
// @access  Public
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'משתמש לא נמצא עם כתובת אימייל זו.' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 דקות
    await user.save({ validateBeforeSave: false });

    const resetURL = `${req.protocol}://${req.get('host')}/api/users/resetpassword/${resetToken}`;
    const htmlMessage = `
      <p>קיבלת אימייל זה מכיוון שביקשת לאפס את הסיסמה שלך.</p>
      <p>אנא לחץ על הקישור הבא כדי לאפס את הסיסמה:</p>
      <a href="${resetURL}">${resetURL}</a>
      <p>אם לא ביקשת זאת, התעלם מאימייל זה.</p>
    `;

    // Send email via MailerSend API
    try {
      await axios.post(
        'https://api.mailersend.com/v1/email',
        {
          from: { email: process.env.EMAIL_FROM, name: 'האפליקציה שלי' },
          to: [{ email: user.email }],
          subject: 'איפוס סיסמה',
          html: htmlMessage,
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.MAILERSEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      res.status(200).json({ success: true, data: 'אימייל נשלח בהצלחה.' });
    } catch (mailError) {
      console.error('שגיאה בשליחת אימייל איפוס סיסמה:', mailError.response?.data || mailError.message);

      // Reset token if sending fails
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });

      if (mailError.response && mailError.response.status === 401) {
        return res.status(401).json({ message: 'שגיאה: מפתח API לא חוקי או שאינו פעיל ב-MailerSend.' });
      }

      return res.status(500).json({ message: 'שגיאה בשליחת אימייל איפוס סיסמה.' });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Reset password
// @route   PUT /api/users/resetpassword/:resettoken
// @access  Public
const resetPassword = async (req, res, next) => {
  try {
    const resetPasswordToken = crypto.createHash('sha256').update(req.params.resettoken).digest('hex');

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: 'אסימון איפוס סיסמה לא חוקי או שפג תוקפו.' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(req.body.password, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'הסיסמה אופסה בהצלחה.',
      token: generateToken(user._id),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerUser,
  loginUser,
  forgotPassword,
  resetPassword,
};
