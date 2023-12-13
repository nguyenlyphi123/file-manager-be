const express = require('express');
const router = express.Router();

const Major = require('../models/Major');
const { authorizeUser } = require('../middlewares/authorization');

// @route POST api/major
// @desc Create new major for lecturers
// @access Public
router.post('/', async (req, res) => {
  const { name } = req.body;

  if (!name)
    return res.status(400).json({
      success: false,
      message: 'Oops! It looks like some data of your request is missing',
    });

  try {
    const majorExists = await Major.findOne({ name });

    if (majorExists)
      return res
        .status(400)
        .json({ success: false, message: 'Major already exists' });

    let createMajor = new Major({ name });

    await createMajor.save();

    res.json({
      success: true,
      message: 'Create major successfully',
      createMajor,
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route GET api/major
// @desc Get all majors
// @access Private
router.get('/', authorizeUser, async (req, res) => {
  try {
    const majors = await Major.find();

    res.json({ success: true, data: majors });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

module.exports = router;
