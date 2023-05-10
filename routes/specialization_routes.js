const express = require('express');
const router = express.Router();

const Specialization = require('../models/Specialization');

// @route POST api/specialization
// @desc Create new specialization for lecturers
// @access Public
router.post('/', async (req, res) => {
  const { name, major } = req.body;

  if (!name || !major)
    return res.status(400).json({
      success: false,
      message: 'Oops! It looks like some data of your request is missing',
    });

  try {
    const specializationExists = await Specialization.findOne({ name, major });

    if (specializationExists)
      return res.status(400).json({
        success: false,
        message: 'Specialization already exists',
      });

    let createSpecialization = new Specialization({ name, major });

    await createSpecialization.save();

    res.json({
      success: true,
      message: 'Create specialization successfully',
      createSpecialization,
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

module.exports = router;
