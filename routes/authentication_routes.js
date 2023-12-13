const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const argon2 = require('argon2');
const passport = require('passport');
const { Types } = require('mongoose');

const { authorizeUser } = require('../middlewares/authorization');

const Account = require('../models/Account');
const Information = require('../models/Information');
const { getAuth, getInfomation } = require('../controllers/auth');
const redisClient = require('../modules/redis');
const { REDIS_AUTH_KEY } = require('../constants/redisKey');
const redis = require('../modules/redis');

let refreshTokens = [];

// @route POST api/authentication/token
// @desc Create new accessToken for all user
// @access Public
router.post('/refresh-token', (req, res) => {
  const refreshToken = req.cookies.refreshToken;

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
        id: user.id,
        permission: user.permission,
        name: user.name,
        email: user.email,
        image: user.image,
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: '1h' },
    );

    const refreshToken = jwt.sign(
      {
        id: user.id,
        permission: user.permission,
        name: user.name,
        email: user.email,
      },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: '5h' },
    );

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      sameSite: 'none',
      secure: true,
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      sameSite: 'none',
      secure: true,
    });

    refreshTokens.push(refreshToken);

    return res.json({ message: 'New accessToken created' });
  });
});

// @route GET api/authentication
// @desc Check if user logged in
// @access private
router.get('/', authorizeUser, async (req, res) => {
  try {
    const cachedUser = await redisClient.getValue(
      `${REDIS_AUTH_KEY}:${req.user.id}`,
    );

    if (cachedUser) {
      return res.json({ success: true, data: JSON.parse(cachedUser) });
    }

    const queries = { _id: new Types.ObjectId(req.user.id) };
    const accountExists = await getAuth(queries);

    if (!accountExists.length === 0)
      return res
        .status(400)
        .json({ success: false, message: 'Account not found' });

    const accountData = {
      id: accountExists[0]._id,
      permission: accountExists[0].permission,
      name: accountExists[0].info.name,
      email: accountExists[0].info.email,
      image: accountExists[0].info.image,
    };

    if (
      !accountData.id ||
      !accountData.permission ||
      !accountData.name ||
      !accountData.email
    )
      return res.status(400).json({
        success: false,
        message: 'Oop! Looks like this is a zoombie account',
      });

    const accessToken = jwt.sign(accountData, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn: '1h',
    });

    const refreshToken = jwt.sign(
      accountData,
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: '5h' },
    );

    refreshTokens.push(refreshToken);

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      sameSite: 'none',
      secure: true,
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      sameSite: 'none',
      secure: true,
    });

    res.json({
      success: true,
      message: 'Login successfully',
      accessToken,
      refreshToken,
      data: accountData,
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route POST api/authentication/lecturers/login
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
    const accountExists = await Account.findOne({ username }).populate('info');

    if (!accountExists)
      return res
        .status(400)
        .json({ success: false, message: 'Account not found' });

    let passwordValid = await argon2.verify(accountExists.password, password);

    if (!passwordValid)
      return res
        .status(400)
        .json({ success: false, message: 'Username or password is incorrect' });

    await Account.findByIdAndUpdate(
      accountExists._id,
      {
        $set: { lastSigned: Date.now() },
      },
      { new: true },
    );

    const accountData = {
      id: accountExists._id,
      permission: accountExists.permission,
      name: accountExists.info.name,
      email: accountExists.info.email,
      image: accountExists.info.image,
    };

    if (
      !accountData.id ||
      !accountData.permission ||
      !accountData.name ||
      !accountData.email
    )
      return res.status(400).json({
        success: false,
        message: 'Oop! Looks like this is a zoombie account',
      });

    const accessToken = jwt.sign(accountData, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn: '1h',
    });

    const refreshToken = jwt.sign(
      accountData,
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: '5h' },
    );

    refreshTokens.push(refreshToken);

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      sameSite: 'none',
      secure: true,
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      sameSite: 'none',
      secure: true,
    });

    redisClient.setValue(
      `${REDIS_AUTH_KEY}:${accountData.id}`,
      JSON.stringify(accountData),
    );

    res.json({
      success: true,
      message: 'Login successfully',
      accessToken,
      refreshToken,
      data: accountData,
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route POST api/authentication/logout
// @desc Logout for all user
// @access Public
router.post('/logout', (req, res) => {
  const uid = req.body.id;

  refreshTokens = refreshTokens.filter(
    (token) => token !== req.body.refreshToken,
  );

  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');

  redisClient.delValue(`${REDIS_AUTH_KEY}:${uid}`);

  res.json({ success: true, message: 'Logout successfully' });
});

// NEW REGISTER //
router.post('/register', async (req, res) => {
  const {
    username,
    password,
    name,
    email,
    major,
    specialization,
    _class,
    permission,
  } = req.body;

  if (!username || !password || !name || !email || !permission)
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
      permission: permission.toUpperCase(),
    });

    const createdAcc = await account.save();

    const accountInfo = new Information({
      account_id: createdAcc._id,
      name,
      email,
      major,
      specialization,
      class: _class,
    });

    const createdInfo = await accountInfo.save();

    createdAcc.info = createdInfo._id;

    await createdAcc.save();

    res.json({
      success: true,
      message: 'Account has been created successfully',
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// google login
// @route GET api/authentication/google/callback
// @desc callback from google consent screen
// @access Public
router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: 'http://localhost:9000/api/authentication/google/failure',
  }),
  async (req, res) => {
    const email = req.user._json.email;
    const queries = { email };
    const accountData = await getInfomation(queries);

    let data;
    let accessToken;
    let refreshToken;

    if (accountData.length !== 0) {
      if (req.user._json.picture && !accountData[0].image) {
        accountData[0].image = req.user._json.picture;
        await accountData[0].save();
      }

      data = {
        id: accountData[0].account_id._id.toString(),
        permission: accountData[0].account_id.permission,
        name: accountData[0].name,
        email,
        image: accountData[0].image,
      };
    } else {
      const hashedPassword = await argon2.hash(
        Math.random().toString(36).substring(2, 15),
      );
      const account = new Account({
        username: email,
        password: hashedPassword,
        permission: 'PUPIL',
      });
      await account.save();

      const accountInfo = new Information({
        account_id: account._id,
        name: req.user._json.name,
        email,
        image: req.user._json.picture,
      });
      await accountInfo.save();

      account.info = accountInfo._id;
      account.save();

      data = {
        id: account._id.toString(),
        permission: account.permission,
        name: accountInfo.name,
        email: accountInfo.email,
        image: accountInfo.image,
      };
    }

    accessToken = jwt.sign(data, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn: '1h',
    });
    refreshToken = jwt.sign(data, process.env.REFRESH_TOKEN_SECRET, {
      expiresIn: '5h',
    });

    refreshTokens.push(refreshToken);

    const cookieOptions = {
      httpOnly: true,
      sameSite: 'none',
      secure: true,
    };

    redisClient.setValue(`${REDIS_AUTH_KEY}:${data.id}`, JSON.stringify(data));

    res.cookie('accessToken', accessToken, cookieOptions);
    res.cookie('refreshToken', refreshToken, cookieOptions);

    res.redirect(process.env.ORIGIN);
  },
);

// @route GET api/authentication/google/failure
// @desc do something when login failed
// @access Public
router.get('/google/failure', (req, res) => {
  res.status(401).json({ success: false, message: 'Login failed' });
});

// @route GET api/authentication/google
// @desc navigate to google consent screen
// @access Public
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'consent',
  }),
);

module.exports = router;
