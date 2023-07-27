const express = require('express');
const router = express.Router();

const Lecturer = require('../models/Lecturers');
const { authorizeUser } = require('../middlewares/authorization');

// @route GET api/lecturer/specialize/:specializeId
// @desc Get all lecturer by specializeId
// @access Private
router.get('/specialize/:specializeId', authorizeUser, async (req, res) => {
  const specializeId = req.params.specializeId;

  try {
    const lecturers = await Lecturer.find({
      specialization: { $in: specializeId },
    }).populate('specialization');

    if (!lecturers)
      return res.status(400).json({
        success: false,
        message: 'Lecturer not found',
      });

    res.json({ success: true, data: lecturers });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

module.exports = router;
