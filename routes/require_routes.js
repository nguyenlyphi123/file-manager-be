const express = require('express');
const router = express.Router();
const { Types } = require('mongoose');

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
const { getRequireWithQuery } = require('../controllers/require');

// @route POST api/require
// @desc Create new require
// @access Private
router.post('/', authorizeUser, async (req, res) => {
  const userId = req.data.id;

  const {
    author,
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
    const receiverIds = [...to.map((item) => item._id), userId];

    const receiverEmails = [...to.map((item) => item.email)];

    const member = to.map((item) => {
      return {
        info: item.account_id,
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
      sharedTo: receiverEmails,
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
      // folder: '123',
      file_type,
      max_size,
      message,
      note,
      startDate,
      endDate,
    });

    await createRequire.save();

    await RequireOrder.updateMany(
      {
        uid: { $in: receiverIds },
      },
      { $push: { waiting: createRequire._id } },
    );

    res.json({
      success: true,
      message: 'Create require successfully',
      data: {
        ...createRequire._doc,
        author: { name: author.name, email: author.email },
      },
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

    if (isDone(require)) {
      return res.status(400).json({
        success: false,
        message: 'This task has been completed and cannot be changed',
      });
    }

    const updateStatusParams = getRequireStatusParams(
      require,
      userId,
      destination.droppableId,
    );

    await require.updateStatus(updateStatusParams);

    // Create promises for updating requireOrder and requireOrderAuthor
    const promises = [
      updateRequireOrder(require, userId, source, destination, requireId),
    ];

    const reqStatus = updateStatusParams.reqStatus;

    if (reqStatus && !isAuthor(require.author, userId)) {
      promises.push(
        updateRequireOrder(
          require,
          userId,
          source,
          destination,
          requireId,
          true, // This indicates updating requireOrderAuthor
        ),
      );
    }

    await Promise.all(promises);

    return res.json({ success: true, message: 'Update status successfully' });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

async function updateRequireOrder(
  require,
  userId,
  source,
  destination,
  requireId,
  isAuthorUpdate = false,
) {
  const requireOrder = await RequireOrder.findOne({ uid: userId });

  const updateOrder = (data, sourceDroppableId, destDroppableId) => {
    if (sourceDroppableId === destDroppableId) {
      const removedRequire = data[sourceDroppableId].splice(source.index, 1);
      data[sourceDroppableId].splice(destination.index, 0, removedRequire[0]);
    } else {
      const sourceData = [...data[sourceDroppableId]];
      const destinationData = [...data[destDroppableId]];

      const removedRequire = sourceData.find(
        (item) => item.toString() === requireId,
      );
      const newSourceData = sourceData.filter(
        (item) => item.toString() !== requireId,
      );

      if (destinationData.length === 0) {
        destinationData.push(removedRequire);
      } else {
        destinationData.splice(destination.index, 0, removedRequire);
      }

      data[sourceDroppableId] = newSourceData;
      data[destDroppableId] = destinationData;
    }
  };

  if (isAuthorUpdate) {
    const requireOrderAuthor = await RequireOrder.findOne({
      uid: require.author,
    });

    updateOrder(
      requireOrderAuthor,
      source.droppableId,
      destination.droppableId,
    );

    return await requireOrderAuthor.save();
  }

  updateOrder(requireOrder, source.droppableId, destination.droppableId);

  await requireOrder.save();
}

// @route PUT api/require/:id
// @desc Update require by id
// @access Private
router.put('/:id', authorizeUser, async (req, res) => {
  const userId = req.data.id;
  const requireId = req.params.id;

  const {
    title,
    to,
    file_type,
    max_size,
    message,
    note,
    startDate,
    endDate,
    folder,
  } = req.body;

  if (!title || to.length === 0 || !file_type || !startDate || !endDate) {
    return res.status(400).json({
      success: false,
      message: 'Oops! It looks like some data of your request is missing',
    });
  }

  try {
    const require = await Require.findById(req.params.id);

    if (!isAuthor(require.author, userId)) {
      return res.status(400).json({
        success: false,
        message: 'You have not permission to update this require',
      });
    }

    if (!require) {
      return res.status(404).json({
        success: false,
        message: 'Require not found',
      });
    }

    const removedMember = require.to
      .filter((i) => !to.find((j) => j.info === i.info.toString()))
      .map((i) => i?.info?.toString());

    const addedMember = to
      .filter((i) => !require.to.find((j) => j.info.toString() === i.info))
      .map((i) => i?.info?.toString());

    const members = [
      ...require.to
        .filter((mem) => !removedMember.includes(mem.info.toString()))
        .map((mem) => ({
          info: mem.info,
          sent: mem.sent,
          seen: mem.seen,
          status: mem.status,
        })),
      ...addedMember.map((mem) => ({
        info: mem,
        sent: false,
        seen: false,
        status: process.env.REQ_STATUS_WAITING,
      })),
    ];

    require.title = title;
    require.to = members;
    require.file_type = file_type;
    require.max_size = max_size;
    require.message = message;
    require.note = note;
    require.folder = folder._id;
    require.startDate = startDate;
    require.endDate = endDate;

    const promises = [
      require.save(),
      removedMember.length > 0 &&
        RequireOrder.updateMany(
          { uid: { $in: removedMember } },
          {
            $pull: {
              waiting: requireId,
              processing: requireId,
              done: requireId,
              cancel: requireId,
            },
          },
        ),
      addedMember.length > 0 &&
        RequireOrder.updateMany(
          { uid: { $in: addedMember } },
          { $push: { waiting: requireId } },
          { new: true },
        ),
    ];

    await Promise.all(promises);

    res.json({
      success: true,
      message: 'Update require successfully',
      data: require,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route DELETE api/require/:id
// @desc Delete require by id
// @access Private
router.delete('/:id', authorizeUser, async (req, res) => {
  const requireId = req.params.id;
  const userId = req.data.id;

  try {
    const require = await Require.findById(requireId);

    if (!require) {
      return res.status(404).json({
        success: false,
        message: 'Require not found',
      });
    }

    if (!isAuthor(require.author, userId)) {
      return res.status(400).json({
        success: false,
        message: 'You have not permission to delete this require',
      });
    }

    const removedMember = require.to.map((i) => i.info.toString());

    removedMember.push(require.author.toString());

    const promises = [
      Require.deleteOne({ _id: requireId }),
      RequireOrder.updateMany(
        { uid: { $in: removedMember } },
        {
          $pull: {
            waiting: requireId,
            processing: requireId,
            done: requireId,
            cancel: requireId,
          },
        },
      ),
    ];

    await Promise.all(promises);

    res.json({
      success: true,
      message: 'Delete require successfully',
      data: require,
    });
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

    const queries = {
      $or: [
        { author: new Types.ObjectId(userId) },
        { 'to.info': new Types.ObjectId(userId) },
      ],
    };

    const requires = await getRequireWithQuery(queries);

    // Group requires by status for the user
    const groupedRequires = {
      waiting: [],
      processing: [],
      done: [],
      cancel: [],
    };

    requires.forEach((require) => {
      const status = isAuthor(require.author._id, userId)
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

// @route GET api/require/new
// @desc Get new require
// @access Private
router.get('/new', authorizeUser, async (req, res) => {
  const userId = req.data.id;

  try {
    const queries = {
      $and: [
        {
          to: {
            $elemMatch: {
              info: new Types.ObjectId(userId),
              status: process.env.REQ_STATUS_WAITING,
            },
          },
        },
        { endDate: { $gte: new Date() } },
      ],
    };

    const requires = await getRequireWithQuery(queries);

    res.json({ success: true, data: requires });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route GET api/require/:id
// @desc Get require by id
// @access Private
router.get('/details/:id', authorizeUser, async (req, res) => {
  const userId = req.data.id;
  const requireId = req.params.id;

  try {
    const queries = {
      $and: [
        {
          $or: [
            { author: new Types.ObjectId(userId) },
            { 'to.info': new Types.ObjectId(userId) },
          ],
        },
        { _id: new Types.ObjectId(requireId) },
      ],
    };

    const require = await getRequireWithQuery(queries);

    res.json({ success: true, data: require[0] });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

module.exports = router;
