const express = require('express');
const router = express.Router();

const { authorizeUser } = require('../middlewares/authorization');
const Account = require('../models/Account');
const Lecturers = require('../models/Lecturers');
const Pupil = require('../models/Pupil');
const Manager = require('../models/Manager');

// @route GET api/account/:search
// @desc Get all accounts by search
// @access Private
router.get('/:search', authorizeUser, async (req, res) => {
  const search = req.params.search;

  try {
    const manager = await Manager.find({
      email: { $regex: search, $options: 'i' },
    });

    const lecturers = await Lecturers.find({
      email: { $regex: search, $options: 'i' },
    });

    const pupil = await Pupil.find({
      email: { $regex: search, $options: 'i' },
    });

    const data = [...manager, ...lecturers, ...pupil];

    if (data.length === 0)
      return res
        .status(404)
        .json({ success: false, message: 'No accounts found' });

    res.json({ success: true, data: data });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

module.exports = router;
