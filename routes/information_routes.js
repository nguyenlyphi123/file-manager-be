const express = require('express');
const router = express.Router();
const { Types } = require('mongoose');

const asyncHandler = require('../middlewares/asyncHandler');
const { authorizeUser } = require('../middlewares/authorization');

const informationController = require('../controllers/information.controller');

const Information = require('../models/Information');
const redisClient = require('../modules/redis');
const { REDIS_INFORMATION_KEY } = require('../constants/redisKey');
const { getInformationWithQuery } = require('../controllers/information');

// @route GET api/information
// @desc Get user information
// @access Private
router.get('/', authorizeUser, async (req, res) => {
  const uid = req.user.id;

  try {
    const cachedInformation = await redisClient.getValue(
      `${REDIS_INFORMATION_KEY}:${uid}`,
    );

    if (cachedInformation) {
      return res.json({ success: true, data: JSON.parse(cachedInformation) });
    }

    const queries = {
      account_id: new Types.ObjectId(uid),
    };

    const information = await getInformationWithQuery(queries);

    if (!information) {
      return res
        .status(404)
        .json({ success: false, message: 'Information not found' });
    }

    redisClient.setValue(
      `${REDIS_INFORMATION_KEY}:${uid}`,
      JSON.stringify(information),
    );

    res.json({ success: true, data: information });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route GET api/information/details/:id
// @desc Get user information by id
// @access Private
router.get(
  '/details/:id',
  authorizeUser,
  informationController.getInformationById,
);

// @route GET api/information/list-grouped-manager
// @desc Get user information by manager major
// @access Private
router.get(
  '/list-grouped-manager',
  authorizeUser,
  asyncHandler(informationController.getGroupedInformationListByManager),
);

// @route GET api/information/list-grouped-admin
// @desc Get user information by admin
// @access Private
router.get(
  '/list-grouped-admin',
  authorizeUser,
  asyncHandler(informationController.getGroupedInformationListByAdmin),
);

// @route GET api/information/list-mentor/:specId
// @desc Get mentors information by specialization id
// @access Private
router.get(
  '/list-mentor/:specId',
  authorizeUser,
  asyncHandler(informationController.getListMentorInfomationWithSpecId),
);

// @route PUT api/information
// @desc Update user information
// @access Private
router.put('/', authorizeUser, async (req, res) => {
  const uid = req.user.id;
  const { name, image } = req.body;

  try {
    const information = await Information.findOneAndUpdate(
      { account_id: uid },
      { name, image },
      { new: true, returnOriginal: false },
    );

    redisClient.delValue(`${REDIS_INFORMATION_KEY}:${uid}`);

    res.json({ success: true, data: information });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route PUT api/information/assign-mentor
// @desc Assign mentor to member
// @access Private
router.put(
  '/assign-mentor',
  authorizeUser,
  asyncHandler(informationController.assignMentor),
);

// @route PUT api/information/assign-role
// @desc Assign role to member
// @access Private
router.put(
  '/assign-role',
  authorizeUser,
  asyncHandler(informationController.assignRole),
);

module.exports = router;
