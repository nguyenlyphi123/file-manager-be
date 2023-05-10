const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const argon2 = require('argon2');

const Account = require('../models/Account');
const Lecturers = require('../models/Lecturers');
const { authorizeUser } = require('../middlewares/authorization');

let refreshTokens = [];

router.get('/cookie/set', (req, res) => {
  res.cookie('accessToken2', 'my cookie');
  res.send('set cookie');
});

router.get('/cookie/get', (req, res) => {
  const cookie = req.cookies;

  res.send(cookie);
});

// @route POST api/authorization/token
// @desc Create new accessToken for all user
// @access Public
router.post('/token', (req, res) => {
  const refreshToken = req.body.token;

  if (refreshToken == null)
    return res
      .status(401)
      .json({ message: 'Access denied! You are not authenticated' });
  if (!refreshTokens.includes(refreshToken))
    return res.status(403).json({ message: 'You do not have permission' });

  jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
    if (err)
      return res.status(403).json({ message: 'You do not have permission' });

    const accessToken = jwt.sign(
      {
        id: accountExists._id,
        lecturers: accountExists.lecturers,
        name: lecturersInfo.name,
        email: lecturersInfo.email,
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: '15m' },
    );

    return res.json({ accessToken });
  });
});

// @route GET api/authorization
// @desc Check if user logged in
// @access private
router.get('/', authorizeUser, async (req, res) => {
  try {
    const accountExists = await Account.findById(req.data.id).select(
      '-password',
    );

    if (!accountExists)
      return res
        .status(400)
        .json({ success: false, message: 'Account not found' });

    const lecturersInfo = await Lecturers.findOne({
      account_id: accountExists._id,
    });

    if (!lecturersInfo)
      return res.status(400).json({
        success: false,
        message: 'Oop! Looks like this is a zoombie account',
      });

    const accessToken = jwt.sign(
      {
        id: accountExists._id,
        lecturers: accountExists.lecturers,
        name: lecturersInfo.name,
        email: lecturersInfo.email,
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: '15m' },
    );

    const refreshToken = jwt.sign(
      {
        id: accountExists._id,
        lecturers: accountExists.lecturers,
        name: lecturersInfo.name,
        email: lecturersInfo.email,
      },
      process.env.REFRESH_TOKEN_SECRET,
    );

    refreshTokens.push(refreshToken);

    const userData = {
      id: accountExists._id,
      lecturers: accountExists.lecturers,
      name: lecturersInfo.name,
      email: lecturersInfo.email,
    };

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      sameSite: 'strict',
    });

    res.json({
      success: true,
      message: 'Login successfully',
      accessToken,
      refreshToken,
      data: userData,
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route POST api/authorization/lecturers/login
// @desc Login account for lecturers
// @access Public
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.status(400).json({
      success: false,
      message: 'Username or password is missing',
    });

  try {
    const accountExists = await Account.findOne({ username });

    if (!accountExists)
      return res
        .status(400)
        .json({ success: false, message: 'Account not found' });

    let passwordValid = await argon2.verify(accountExists.password, password);

    if (!passwordValid)
      return res
        .status(400)
        .json({ success: false, message: 'Username or password is incorrect' });

    const lecturersInfo = await Lecturers.findOne({
      account_id: accountExists._id,
    });

    if (!lecturersInfo)
      return res.status(400).json({
        success: false,
        message: 'Oop! Looks like this is a zoombie account',
      });

    const accessToken = jwt.sign(
      {
        id: accountExists._id,
        lecturers: accountExists.lecturers,
        name: lecturersInfo.name,
        email: lecturersInfo.email,
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: '15m' },
    );

    const refreshToken = jwt.sign(
      {
        id: accountExists._id,
        lecturers: accountExists.lecturers,
        name: lecturersInfo.name,
        email: lecturersInfo.email,
      },
      process.env.REFRESH_TOKEN_SECRET,
    );

    refreshTokens.push(refreshToken);

    const userData = {
      id: accountExists._id,
      lecturers: accountExists.lecturers,
      name: lecturersInfo.name,
      email: lecturersInfo.email,
    };

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      sameSite: 'strict',
    });

    res.json({
      success: true,
      message: 'Login successfully',
      accessToken,
      refreshToken,
      data: userData,
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route DELETE api/authorization/logout
// @desc Logout for all user
// @access Public
router.delete('/logout', (req, res) => {
  refreshTokens = refreshTokens.filter((token) => token !== req.body.token);

  res.json({ success: true, message: 'Logout successfully' });
});

// Lecturers //
// @route POST api/authorization/lecturers/register
// @desc Create new account for lecturers
// @access Public
router.post('/lecturers/register', async (req, res) => {
  const { username, password, name, email, major, specialization } = req.body;

  if (!username || !password || !name || !email || !major || !specialization)
    return res.status(400).json({
      success: false,
      message: 'Oops! It looks like some data of your request is missing',
    });

  try {
    const usernameExists = await Account.findOne({ username });

    if (usernameExists)
      return res
        .status(400)
        .json({ success: false, message: 'Username already exists' });

    let hashedPassword = await argon2.hash(password);

    let account = new Account({
      username,
      password: hashedPassword,
      lecturers: true,
    });

    await account.save().then(async (account) => {
      let accountInfo = new Lecturers({
        account_id: account._id,
        name,
        email,
        major,
        specialization,
      });

      await accountInfo.save();

      res.json({
        success: true,
        message: 'Account has been created successfully',
      });
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

module.exports = router;
