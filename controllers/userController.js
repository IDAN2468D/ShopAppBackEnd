const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const axios = require('axios');

// פונקציה ליצירת טוקן JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

// ---------------------------- REGISTER ----------------------------
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

// ---------------------------- LOGIN ----------------------------
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

// ---------------------------- DELETE ----------------------------
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

// ---------------------------- FORGOT PASSWORD ----------------------------
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'משתמש לא נמצא עם כתובת אימייל זו.' });
    }

    // יצירת טוקן איפוס
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

    const fromEmail = process.env.EMAIL_FROM || 'noreply@mailersend.net';
    const fromName = 'האפליקציה שלי';

    try {
      // שליחת האימייל דרך MailerSend
      await axios.post(
        'https://api.mailersend.com/v1/email',
        {
          from: { email: fromEmail, name: fromName },
          to: [{ email: user.email }],
          subject: 'איפוס סיסמה',
          html: htmlMessage,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.MAILERSEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      res.status(200).json({ success: true, data: 'אימייל נשלח בהצלחה.' });
    } catch (mailError) {
      console.error('שגיאה בשליחת אימייל איפוס סיסמה:', mailError.response?.data || mailError.message, mailError.response);

      // טיפול אוטומטי בשגיאת אימות דומיין (#MS42207)
      const errorMessage = mailError.response?.data?.message || '';
      if (errorMessage.includes('domain must be verified')) {
        console.log('⚠️ דומיין לא מאומת - ניסיון שליחה עם מייל ברירת מחדל של MailerSend...');
        await axios.post(
          'https://api.mailersend.com/v1/email',
          {
            from: { email: 'noreply@mailersend.net', name: fromName },
            to: [{ email: user.email }],
            subject: 'איפוס סיסמה',
            html: htmlMessage,
          },
          {
            headers: {
              Authorization: `Bearer ${process.env.MAILERSEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
          }
        );
        return res.status(200).json({ success: true, data: 'האימייל נשלח ממייל ברירת מחדל של MailerSend.' });
      }

      // איפוס טוקן אם נכשלת השליחה
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

// ---------------------------- RESET PASSWORD ----------------------------
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

// ---------------------------- EXPORTS ----------------------------
module.exports = {
  registerUser,
  loginUser,
  deleteUser,
  forgotPassword,
  resetPassword,
};
