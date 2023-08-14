const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const argon2 = require('argon2');

const { authorizeUser } = require('../middlewares/authorization');

const Account = require('../models/Account');
const Lecturers = require('../models/Lecturers');
const Pupil = require('../models/Pupil');
const Class = require('../models/Class');
const Manager = require('../models/Manager');

let refreshTokens = [];

// @route POST api/authorization/token
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

    let accountData = {
      id: null,
      permission: null,
      name: null,
      email: null,
    };

    switch (accountExists.permission) {
      case process.env.PERMISSION_LECTURERS:
        const lecturersInfo = await Lecturers.findOne({
          account_id: accountExists._id,
        });
        accountData = {
          id: accountExists._id,
          permission: accountExists.permission,
          name: lecturersInfo.name,
          email: lecturersInfo.email,
        };
        break;

      case process.env.PERMISSION_PUPIL:
        const pupilInfo = await Pupil.findOne({
          account_id: accountExists._id,
        });
        accountData = {
          id: accountExists._id,
          permission: accountExists.permission,
          name: pupilInfo.name,
          email: pupilInfo.email,
        };
        break;

      default:
        break;
    }

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

    await Account.findByIdAndUpdate(
      accountExists._id,
      {
        $set: { lastSigned: Date.now() },
      },
      { new: true },
    );

    let accountData = {
      id: null,
      permission: null,
      name: null,
      email: null,
    };

    switch (accountExists.permission) {
      case process.env.PERMISSION_MANAGER:
        const managerInfo = await Manager.findOne({
          account_id: accountExists._id,
        });
        accountData = {
          id: accountExists._id,
          permission: accountExists.permission,
          name: managerInfo.name,
          email: managerInfo.email,
        };
        break;

      case process.env.PERMISSION_LECTURERS:
        const lecturersInfo = await Lecturers.findOne({
          account_id: accountExists._id,
        });
        accountData = {
          id: accountExists._id,
          permission: accountExists.permission,
          name: lecturersInfo.name,
          email: lecturersInfo.email,
        };
        break;

      case process.env.PERMISSION_PUPIL:
        const pupilInfo = await Pupil.findOne({
          account_id: accountExists._id,
        });
        accountData = {
          id: accountExists._id,
          permission: accountExists.permission,
          name: pupilInfo.name,
          email: pupilInfo.email,
        };
        break;

      default:
        break;
    }

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

// @route POST api/authorization/logout
// @desc Logout for all user
// @access Public
router.post('/logout', (req, res) => {
  refreshTokens = refreshTokens.filter(
    (token) => token !== req.body.refreshToken,
  );

  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');

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
      permission: process.env.PERMISSION_LECTURERS,
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

// Pupils //
// @route POST api/authorization/pupil/register
// @desc Create new account for pupils
// @access Public
router.post('/pupil/register', async (req, res) => {
  const { username, password, name, email, specialization, class_ } = req.body;

  if (!username || !password || !name || !email || !specialization || !class_)
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
      permission: process.env.PERMISSION_PUPIL,
    });

    await account.save().then(async (account) => {
      let accountInfo = new Pupil({
        account_id: account._id,
        name,
        email,
        specialization,
        class: class_,
      });

      await accountInfo.save();
      await Class.updateOne(
        { _id: class_ },
        { $push: { pupil: account._id } },
        { new: true },
      );

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

// Manager
// @route POST api/authorization/manager/register
// @desc Create new account for manager
// @access Public
router.post('/manager/register', async (req, res) => {
  const { username, password, name, email, major } = req.body;

  if (!username || !password || !name || !email || !major) {
    return res.status(400).json({
      success: false,
      message: 'Oops! It looks like some data of your request is missing',
    });
  }

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
      permission: process.env.PERMISSION_MANAGER,
    });

    await account.save().then(async (account) => {
      let accountInfo = new Manager({
        account_id: account._id,
        name,
        email,
        major,
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
