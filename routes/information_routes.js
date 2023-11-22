const express = require('express');
const router = express.Router();

const { authorizeUser } = require('../middlewares/authorization');
const Information = require('../models/Information');

// @route GET api/information
// @desc Get user information
// @access Private
router.get('/', authorizeUser, async (req, res) => {
  const uid = req.data.id;

  try {
    const information = await Information.findOne({ account_id: uid }).populate(
      [
        {
          path: 'account_id',
          select: 'username permission',
        },
        {
          path: 'major',
          select: 'name',
        },
        {
          path: 'specialization',
          select: 'name',
        },
        {
          path: 'class',
          select: 'name',
        },
      ],
    );

    if (!information) {
      return res
        .status(404)
        .json({ success: false, message: 'Information not found' });
    }

    res.json({ success: true, data: information });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route PUT api/information
// @desc Update user information
// @access Private
router.put('/', authorizeUser, async (req, res) => {
  const uid = req.data.id;
  const { name, image } = req.body;

  try {
    const information = await Information.findOneAndUpdate(
      { account_id: uid },
      { name, image },
      { new: true, returnOriginal: false },
    );

    res.json({ success: true, data: information });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

module.exports = router;
