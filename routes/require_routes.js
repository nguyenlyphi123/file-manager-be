const express = require('express');
const router = express.Router();

const { authorizeUser } = require('../middlewares/authorization');

const Require = require('../models/Require');
const RequireOrder = require('../models/RequireOrder');
const Folder = require('../models/Folder');

// @route POST api/require
// @desc Create new require
// @access Private
router.post('/', authorizeUser, async (req, res) => {
  const userId = req.data.id;

  const {
    title,
    to,
    folder,
    file_type,
    max_size,
    message,
    note,
    startDate,
    endDate,
  } = req.body;

  if (!title || to.length === 0 || !file_type || !startDate || !endDate)
    return res.status(400).json({
      success: false,
      message: 'Oops! It looks like some data of your request is missing',
    });

  try {
    const requireOrder = await RequireOrder.findOne({ uid: userId });

    const member = to.map((item) => {
      return {
        info: item,
        sent: false,
        seen: false,
      };
    });

    if (member.length === 0)
      return res.status(400).json({
        success: false,
        message: 'Oops! It looks like some data of your request is missing',
      });

    const newFolder = new Folder({
      name: folder.name,
      parent_folder: folder.parent_folder,
      author: userId,
      sharedTo: to,
      permission: ['READ', 'WRITE'],
      isRequireFolder: true,
      owner: folder.owner ? folder.owner : userId,
    });

    await newFolder.save();

    let createRequire = new Require({
      title,
      author: userId,
      to: member,
      folder: newFolder._id,
      file_type,
      max_size,
      message,
      note,
      startDate,
      endDate,
    });

    await createRequire.save();

    if (!requireOrder) {
      const newRequireOrder = new RequireOrder({
        uid: userId,
        waiting: [createRequire._id],
        processing: [],
        done: [],
        cancel: [],
      });

      await newRequireOrder.save();

      return res.json({
        success: true,
        message: 'Create require successfully',
        data: createRequire,
      });
    }

    requireOrder.waiting.push(createRequire._id);
    await requireOrder.save();

    res.json({
      success: true,
      message: 'Create require successfully',
      data: createRequire,
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route PUT api/require/status
// @desc Update status of require
// @access Private
router.put('/status', authorizeUser, async (req, res) => {
  const userId = req.data.id;
  const { source, destination, requireId } = req.body;

  try {
    const require = await Require.findById(requireId);

    let updateStatusParams = {
      accountId: userId,
      memStatus:
        userId !== require.author.toString() ? destination.droppableId : null,
      reqStatus:
        userId === require.author.toString() ? destination.droppableId : null,
    };

    await require.updateStatus(updateStatusParams);

    const requireOrder = await RequireOrder.findOne({ uid: userId });

    if (destination.droppableId === source.droppableId) {
      const data = [...requireOrder[source.droppableId]];
      const removedRequire = data.splice(source.index, 1);
      data.splice(destination.index, 0, removedRequire[0]);

      requireOrder[source.droppableId] = data;
    } else {
      const sourceData = [...requireOrder[source.droppableId]];
      const destinationData = [...requireOrder[destination.droppableId]];

      const removedRequire = sourceData.splice(source.index, 1);
      const newSourceData = sourceData.filter(
        (item) => item.toString() !== requireId,
      );

      destinationData.splice(destination.index, 0, removedRequire[0]);

      requireOrder[source.droppableId] = newSourceData;
      requireOrder[destination.droppableId] = destinationData;
    }

    await requireOrder.save();

    return res.json({ success: true, message: 'Update status successfully' });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route GET api/require
// @desc Get all require
// @access Private
router.get('/', authorizeUser, async (req, res) => {
  const userId = req.data.id;

  try {
    const requires = await Require.find({
      $or: [{ 'author': userId }, { 'to': { $elemMatch: { 'info': userId } } }],
    })
      .populate({
        path: 'to.info',
        select: 'permission',
        populate: {
          path: 'info',
          select: 'name email',
        },
      })
      .populate('folder')
      .populate({
        path: 'author',
        select: 'info',
        populate: {
          path: 'info',
          select: 'name email',
        },
      });

    const requireOrder = await RequireOrder.findOne(
      { uid: userId },
      { _id: 0, waiting: 1, processing: 1, done: 1, cancel: 1 },
    );

    const resData = {
      requires,
      requireOrder: requireOrder || {
        waiting: [],
        processing: [],
        done: [],
        cancel: [],
      },
    };

    res.json({ success: true, data: resData });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

module.exports = router;
