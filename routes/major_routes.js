const express = require('express');
const router = express.Router();

const Major = require('../models/Major');

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

module.exports = router;
