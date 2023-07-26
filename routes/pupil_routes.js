const express = require('express');
const router = express.Router();

const Pupil = require('../models/Pupil');
const { authorizeUser } = require('../middlewares/authorization');

// @route GET api/pupil/class/:classId
// @desc Get all pupil by class id
// @access Private
router.get('/class/:classId', authorizeUser, async (req, res) => {
  const classId = req.params.classId;

  try {
    const pupils = await Pupil.find({ class: classId }).populate('class');

    if (!pupils)
      return res.status(400).json({
        success: false,
        message: 'Pupil not found',
      });

    res.json({ success: true, data: pupils });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

module.exports = router;
