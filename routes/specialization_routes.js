const express = require('express');
const router = express.Router();

const { authorizeUser } = require('../middlewares/authorization');
const Specialization = require('../models/Specialization');
const Lecturers = require('../models/Lecturers');
const Pupil = require('../models/Pupil');
const Class = require('../models/Class');
const Manager = require('../models/Manager');

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

// @route GET api/specialization
// @desc Get all specialization
// @access Public
router.get('/', authorizeUser, async (req, res) => {
  const userId = req.data.id;
  const permission = req.data.permission;

  try {
    const userData = await getUserData(userId, permission);

    if (!userData) {
      return res
        .status(400)
        .json({ success: false, message: 'You are not authorized' });
    }

    let specialization;

    if (permission === process.env.PERMISSION_MANAGER) {
      specialization = await getSpecializationByManager(userData.major);
    } else {
      specialization = await getSpecializationByLecturers(
        userData.specialization,
      );
    }

    const updatedSpecializations = await getSpecializationData(specialization);

    res.json({ success: true, data: updatedSpecializations });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

const getUserData = async (userId, permission) => {
  switch (permission) {
    case process.env.PERMISSION_MANAGER:
      return await Manager.findOne({ account_id: userId });

    case process.env.PERMISSION_LECTURERS:
      return await Lecturers.findOne({ account_id: userId });

    case process.env.PERMISSION_PUPIL:
      return await Pupil.findOne({ account_id: userId });

    default:
      return null;
  }
};

const getSpecializationByManager = async (major) => {
  return await Specialization.find({ major });
};

const getSpecializationByLecturers = async (specializationIds) => {
  return await Specialization.find({ _id: { $in: specializationIds } });
};

const getSpecializationData = async (specializations) => {
  const specializationIds = specializations.map((item) => item._id);

  const classPromises = specializationIds.map(async (id) => {
    const data = await Class.find({ specialization: id });
    const memberCount = data.length;
    return { id, member: memberCount };
  });

  const specializedData = await Promise.all(classPromises);

  const updatedSpecializations = specializations.map((item) => {
    const matchedData = specializedData.find((data) =>
      data.id.equals(item._id),
    );
    const memberCount = matchedData ? matchedData.member : 0;
    return { ...item.toObject(), member: memberCount };
  });

  return updatedSpecializations;
};

module.exports = router;
