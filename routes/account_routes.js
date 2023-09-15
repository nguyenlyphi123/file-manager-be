const express = require('express');
const router = express.Router();

const { authorizeUser } = require('../middlewares/authorization');
const Account = require('../models/Account');
const Information = require('../models/Information');

// @route GET api/account/:search
// @desc Get all accounts by search
// @access Private
router.get('/:search', authorizeUser, async (req, res) => {
  const search = req.params.search;

  try {
    const information = await Information.find({
      email: { $regex: search, $options: 'i' },
    });

    if (information.length === 0)
      return res
        .status(404)
        .json({ success: false, message: 'No accounts found' });

    res.json({ success: true, data: information });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

module.exports = router;
