const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const MailerLite = require('@mailerlite/mailerlite-nodejs').default;

const mailerlite = new MailerLite({
  apiKey: process.env.MAILERLITE_API_KEY, // API Key מ-MailerLite
});

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

    if (user) {
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        token: generateToken(user._id),
      });
    } else {
      res.status(400).json({ message: 'נתונים לא חוקיים של משתמש.' });
    }
  } catch (error) {
    console.error('שגיאה ברישום משתמש:', error);
    next(error);
  }
};

// @desc    Authenticate user & get token
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

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private
const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'משתמש לא נמצא.' });
    }

    await user.deleteOne();
    res.json({ message: 'המשתמש נמחק בהצלחה.' });
  } catch (error) {
    console.error('שגיאה במחיקת משתמש:', error);
    next(error);
  }
};

// @desc    Forgot password using MailerLite SDK
// @route   POST /api/users/forgotpassword
// @access  Public
const forgotPassword = async (req, res, next) => {
  let user; // <-- הגדרה מחוץ ל-try כדי שתהיה גישה גם ב-catch
  try {
    const { email } = req.body;

    user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'משתמש לא נמצא עם כתובת אימייל זו.' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 דקות
    await user.save({ validateBeforeSave: false });

    const resetURL = `${req.protocol}://${req.get('host')}/api/users/resetpassword/${resetToken}`;
    const message = `קיבלת אימייל זה מכיוון שביקשת לאפס את הסיסמה שלך. אנא בקר בקישור הבא: \n\n ${resetURL} \n\n אם לא ביקשת זאת, אנא התעלם מאימייל זה.`;

    // Send email via MailerLite SDK
    await mailerlite.emails.send({
      subject: 'איפוס סיסמה',
      from: { email: process.env.EMAIL_FROM, name: 'האפליקציה שלי' },
      to: [{ email: user.email }],
      html: `<p>${message}</p>`,
    });

    res.status(200).json({ success: true, data: 'אימייל נשלח בהצלחה.' });
  } catch (error) {
    // Reset token if sending fails
    if (user) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });
    }
    console.error('שגיאה בשליחת אימייל איפוס סיסמה:', error.message);
    return res.status(500).json({ message: 'שגיאה בשליחת אימייל איפוס סיסמה.' });
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
  deleteUser,
  forgotPassword,
  resetPassword,
};
