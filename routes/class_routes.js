const express = require('express');
const router = express.Router();

const Class = require('../models/Class');
const { authorizeUser } = require('../middlewares/authorization');

// @route POST api/class
// @desc Create a class
// @access Private
router.post('/', async (req, res) => {
  const { name, specialization } = req.body;

  try {
    const newClass = new Class({
      name,
      specialization,
    });

    await newClass.save();

    res.json({
      success: true,
      message: 'Create class successfully',
      data: newClass,
    });
  } catch (err) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route GET api/class/:specId
// @desc Get all class by specialization id
// @access Private
router.get('/:specId', authorizeUser, async (req, res) => {
  const specId = req.params.specId;

  try {
    const classes = await Class.find({ specialization: specId });

    if (!classes)
      return res.status(400).json({
        success: false,
        message: 'Class not found',
      });

    res.json({ success: true, data: classes });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

module.exports = router;
