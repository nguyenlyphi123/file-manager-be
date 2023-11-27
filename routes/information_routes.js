const express = require('express');
const router = express.Router();
const { Types } = require('mongoose');

const { authorizeUser } = require('../middlewares/authorization');
const { getInformationWithQuery } = require('../controllers/information');

const Information = require('../models/Information');

// @route GET api/information
// @desc Get user information
// @access Private
router.get('/', authorizeUser, async (req, res) => {
  const uid = req.data.id;

  try {
    const queries = {
      account_id: new Types.ObjectId(uid),
    };

    const information = await getInformationWithQuery(queries);

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
