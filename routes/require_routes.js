const express = require('express');
const router = express.Router();

const { authorizeUser } = require('../middlewares/authorization');

const Require = require('../models/Require');
const RequireOrder = require('../models/RequireOrder');
const Folder = require('../models/Folder');
const {
  isDone,
  getRequireStatusParams,
  isAuthor,
  getMemberStatus,
  sortByOrder,
} = require('../helpers/RequireHelper');

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

    if (isDone(require))
      return res.status(400).json({
        success: false,
        message: 'This task has been completed and cannot be changed',
      });

    let updateStatusParams = getRequireStatusParams(
      require,
      userId,
      destination.droppableId,
    );

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
  try {
    const userId = req.data.id;

    // Find all requires for the user
    const requires = await Require.find({
      $or: [{ author: userId }, { 'to.info': userId }],
    }).populate([
      {
        path: 'author',
        select: 'info',
        populate: {
          path: 'info',
          select: 'name email',
        },
      },
      {
        path: 'to.info',
        select: 'permission',
        populate: {
          path: 'info',
          select: 'name email',
        },
      },
      {
        path: 'folder',
        select: 'name parent_folder',
      },
    ]);

    // Group requires by status for the user
    const groupedRequires = {
      waiting: [],
      processing: [],
      done: [],
      cancel: [],
    };

    requires.forEach((require) => {
      const status = isAuthor(require, userId)
        ? require.status
        : getMemberStatus(require, userId);
      groupedRequires[status].push(require);
    });

    // Get the user's require order
    const requireOrder = await RequireOrder.findOne(
      { uid: userId },
      { _id: 0, uid: 0 },
    );

    // Sort requires based on the user's require order
    const sortedWaitingRequire = sortByOrder(
      groupedRequires.waiting,
      requireOrder.waiting,
    );
    const sortedProcessingRequire = sortByOrder(
      groupedRequires.processing,
      requireOrder.processing,
    );
    const sortedDoneRequire = sortByOrder(
      groupedRequires.done,
      requireOrder.done,
    );
    const sortedCancelRequire = sortByOrder(
      groupedRequires.cancel,
      requireOrder.cancel,
    );

    // Create response data
    const resData = {
      waiting: sortedWaitingRequire,
      processing: sortedProcessingRequire,
      done: sortedDoneRequire,
      cancel: sortedCancelRequire,
    };

    res.json({ success: true, data: resData });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

module.exports = router;
