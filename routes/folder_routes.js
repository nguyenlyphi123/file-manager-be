const express = require('express');
const router = express.Router();
const { Types } = require('mongoose');

const Folder = require('../models/Folder');
const File = require('../models/File');

const authorization = require('../middlewares/authorization');
const { genFolderLocation } = require('../helpers/folder.helper');
const { getFolderWithQuery } = require('../controllers/folder');
const { REDIS_FOLDERS_KEY } = require('../constants/redisKey');
const redisClient = require('../modules/redis');
const folderController = require('../controllers/folder.controller');
const asyncHandler = require('../middlewares/asyncHandler');
const { findAllSubFolder } = require('../helpers/folder.helper');
// @route POST api/folder
// @desc Create new folder
// @access Private
router.post(
  '/',
  authorization.authorizeUser,
  asyncHandler(folderController.createFolder),
);

// @route POST api/folder/quick-access
// @desc Create new folder with quick access property
// @access Private
router.post(
  '/quick-access',
  authorization.authorizeUser,
  asyncHandler(folderController.createAccessFolder),
);

// @route POST api/folder/copy
// @desc Copy folder by folderId
// @access Private
router.post(
  '/copy',
  authorization.authorizeUser,
  asyncHandler(folderController.copyFolder),
);

// @route POST api/folder/move
// @desc Move folder by folderId
// @access Private
router.post(
  '/move',
  authorization.authorizeUser,
  asyncHandler(folderController.moveFolder),
);

// @route POST api/folder/delete
// @desc Delete folder by folderId
// @access Private
router.post(
  '/delete',
  authorization.authorizeUser,
  asyncHandler(folderController.deleteFolder),
);

// @route POST api/folder/multiple-delete
// @desc Delete multiple folders by folder list
// @access Private
router.post(
  '/multiple-delete',
  authorization.authorizeUser,
  asyncHandler(folderController.deleteMultipleFolder),
);

// @route POST api/folder/share
// @desc Share folder by folderId to emails
// @access Private
router.post('/share', authorization.authorizeUser, async (req, res) => {
  const userId = req.user.id;
  const { folderId, emails, permissions } = req.body;

  if (!folderId || !emails)
    return res.status(400).json({
      success: false,
      message: 'Oops! It looks like some data of your request is missing',
    });

  try {
    const folder = await Folder.findOne({
      _id: folderId,
    });

    if (!folder)
      return res
        .status(404)
        .json({ success: false, message: 'Folder not found' });

    if (!folder.author.toString() === userId) {
      if (
        !folder.sharedTo.includes(userId) &&
        !folder.permission.includes(process.env.PERMISSION_SHARE)
      ) {
        return res.status(400).json({
          success: false,
          message: 'You do not have permission to do this',
        });
      }

      await Folder.updateOne(
        {
          _id: folderId,
        },
        {
          $addToSet: { sharedTo: emails },
          $set: { modifiedAt: Date.now() },
        },
        { new: true },
      );

      redisClient.delWithKeyMatchPrefix(`${REDIS_FOLDERS_KEY}:${userId}`);

      res.json({
        success: true,
        message: 'Folder has been shared successfully',
      });
    }

    await Folder.updateOne(
      {
        _id: folderId,
      },
      {
        $addToSet: { sharedTo: emails, permission: permissions },
        $set: { modifiedAt: Date.now() },
      },
      { new: true },
    );

    redisClient.delWithKeyMatchPrefix(`${REDIS_FOLDERS_KEY}:${userId}`);

    res.json({ success: true, message: 'Folder has been shared successfully' });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route POST api/folder/un-share
// @desc Un share folder by folderId
// @access Private
router.put(
  '/unshare/:folderId',
  authorization.authorizeUser,
  async (req, res) => {
    const uid = req.user.id;
    const folderId = req.params.folderId;

    try {
      await Folder.updateOne(
        { _id: folderId, author: uid },
        { sharedTo: [], permission: [] },
      );

      redisClient.delWithKeyMatchPrefix(`${REDIS_FOLDERS_KEY}:${uid}`);

      res.json({
        success: true,
        message: 'Folder has been unshared successfully',
      });
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ success: false, message: 'Internal Server Error' });
    }
  },
);

// @route PUT api/folder/:folderId/restore
// @desc Restore folder by folderId
// @access Private
router.put(
  '/:folderId/restore',
  authorization.authorizeUser,
  async (req, res) => {
    const userId = req.user.id;
    const folderId = req.params.folderId;
    const folderRestoreArray = [];

    try {
      // Find the folder to restore
      const folderExists = await Folder.findOne({
        _id: folderId,
        author: userId,
        isDelete: true,
      });

      if (!folderExists) {
        return res.status(404).json({
          success: false,
          message:
            'Folder does not exists or you are not permission to do this',
        });
      }

      // Populate the folderRestoreArray
      folderRestoreArray.push(folderExists._id);
      await findAllSubFolder(folderId, folderRestoreArray);

      // Restore all folders using Promise.all
      const promises = folderRestoreArray.map(async (id) => {
        try {
          return Folder.findByIdAndUpdate(
            id,
            { isDelete: false, modifiedAt: Date.now() },
            { new: true },
          );
        } catch (error) {
          throw error;
        }
      });

      await Promise.all(promises);

      redisClient.delWithKeyMatchPrefix(`${REDIS_FOLDERS_KEY}:${userId}`);

      return res.json({
        success: true,
        message: 'Folder has been restored successfully',
      });
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ success: false, message: 'Internal Server Error' });
    }
  },
);

// @route POST api/folder/mutiple-restore
// @desc Restore multiple folders by folder list
// @access Private
router.post(
  '/multiple-restore',
  authorization.authorizeUser,
  async (req, res) => {
    const userId = req.user.id;
    const folders = req.body.folders;
    const folderIdsToRestore = folders.map((folder) => folder._id);

    try {
      await Folder.updateMany(
        { _id: { $in: folderIdsToRestore }, author: userId },
        { isDelete: false, modifiedAt: Date.now() },
        { new: true },
      );

      redisClient.delWithKeyMatchPrefix(`${REDIS_FOLDERS_KEY}:${userId}`);

      res.json({
        success: true,
        message: 'Folders has been restored successfully',
      });
    } catch (error) {
      console.log(error);
      return res
        .status(500)
        .json({ success: false, message: 'Internal Server Error' });
    }
  },
);

// @route PUT api/folder/:folderId
// @desc Update folder by folderId
// @access Private
router.put('/:folderId', authorization.authorizeUser, async (req, res) => {
  const folderId = req.params.folderId;
  const userId = req.user.id;
  const email = req.user.email;

  const { name, parent_folder } = req.body;

  try {
    const folderBeforeChange = await Folder.findOne({
      _id: folderId,
    });

    if (folderBeforeChange.author.toString() !== userId) {
      if (
        !folderBeforeChange.sharedTo.includes(email) ||
        !folderBeforeChange.permission.includes(process.env.PERMISSION_EDIT)
      ) {
        return res.status(400).json({
          success: false,
          message: 'You do not have permission to do this',
        });
      } else {
        await Folder.updateOne({ _id: folderId }, { name });

        redisClient.delWithKeyMatchPrefix(`${REDIS_FOLDERS_KEY}:${userId}`);

        return res.json({
          success: true,
          message: 'Folder has been updated successfully',
        });
      }
    }

    const updateData = {
      name,
      parent_folder: parent_folder
        ? parent_folder
        : folderBeforeChange.parent_folder,
    };

    const updateFolder = await Folder.findOneAndUpdate(
      { _id: folderId },
      updateData,
      { new: true },
    );

    if (!updateFolder)
      return res
        .status(404)
        .json({ success: false, message: 'Folder not found' });

    // change sub_folder item if parent_folder change
    if (folderBeforeChange.parent_folder !== parent_folder) {
      // remove sub_folder item in parent_folder before change
      await Folder.updateOne(
        { _id: folderBeforeChange.parent_folder },
        { $pull: { sub_folder: updateFolder._id } },
      );

      // add sub_folder item in parent_folder after change
      await Folder.updateOne(
        { _id: updateFolder.parent_folder },
        { $addToSet: { sub_folder: updateFolder._id } },
      );
    }

    redisClient.delWithKeyMatchPrefix(`${REDIS_FOLDERS_KEY}:${userId}`);

    res.json({
      success: true,
      message: 'Folder has been updated successfully',
      data: updateFolder,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route PUT api/folder/star/:folderId
// @desc Star folder by folderId
// @access Private
router.put('/star/:folderId', authorization.authorizeUser, async (req, res) => {
  const userId = req.user.id;
  const folderId = req.params.folderId;

  try {
    const folder = await Folder.findOneAndUpdate(
      { _id: folderId, author: userId },
      { isStar: true },
      { new: true },
    );

    if (!folder)
      return res.status(404).json({
        success: false,
        message: 'You do not have permission to do this',
      });

    redisClient.delWithKeyMatchPrefix(`${REDIS_FOLDERS_KEY}:${userId}`);

    return res.json({
      success: true,
      message: 'Folder has been starred successfully',
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route PUT api/folder/unstar/:folderId
// @desc Unstar folder by folderId
// @access Private
router.put('/unstar/single', authorization.authorizeUser, async (req, res) => {
  const userId = req.user.id;
  const folderId = req.body.folderId;

  try {
    const folder = await Folder.findOneAndUpdate(
      { _id: folderId, author: userId },
      { isStar: false },
      { new: true },
    );

    if (!folder) {
      return res.status(404).json({
        success: false,
        message: 'You do not have permission to do this',
      });
    }

    redisClient.delWithKeyMatchPrefix(`${REDIS_FOLDERS_KEY}:${userId}`);

    return res.json({
      success: true,
      message: 'Folder has been unstarred successfully',
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route PUT api/folder/update/unstar-list-folder
// @desc Unstar list folder by folderId
// @access Private
router.put(
  '/unstar/list-folder',
  authorization.authorizeUser,
  async (req, res) => {
    const userId = req.user.id;
    const folderIdList = req.body.folderIdList;

    try {
      await Folder.updateMany(
        { _id: { $in: folderIdList }, author: userId },
        { isStar: false },
        { new: true },
      );

      redisClient.delWithKeyMatchPrefix(`${REDIS_FOLDERS_KEY}:${userId}`);

      return res.json({
        success: true,
        message: 'Folders has been unstarred successfully',
      });
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ success: false, message: 'Internal Server Error' });
    }
  },
);

// @route PUT api/folder/:folderId/trash
// @desc Fake delete folder by folderId
// @access Private
router.put(
  '/:folderId/trash',
  authorization.authorizeUser,
  async (req, res) => {
    const userId = req.user.id;
    const email = req.user.email;
    const folderId = req.params.folderId;
    const folderDeleteArray = [];

    try {
      // Find the folder to delete
      const folderExists = await Folder.findOne({
        _id: folderId,
      });

      if (
        folderExists.author.toString() !== userId &&
        folderExists.sharedTo.includes(email)
      ) {
        await Folder.updateOne(
          { _id: folderId },
          { $pull: { sharedTo: email } },
        );

        redisClient.delWithKeyMatchPrefix(`${REDIS_FOLDERS_KEY}:${userId}`);

        return res.json({
          success: true,
          message: 'Folder has been removed from your drive',
        });
      }

      if (!folderExists) {
        return res.status(404).json({
          success: false,
          message: 'You do not have permission to do this',
        });
      }

      // Populate the folderDeleteArray
      folderDeleteArray.push(folderExists._id);
      await findAllSubFolder(folderId, folderDeleteArray);

      // Delete all folders using Promise.all
      const promises = folderDeleteArray.map(async (id) => {
        try {
          return Folder.findByIdAndUpdate(
            id,
            { isDelete: true, modifiedAt: Date.now() },
            { new: true },
          );
        } catch (error) {
          throw error;
        }
      });

      await Promise.all(promises);

      redisClient.delWithKeyMatchPrefix(`${REDIS_FOLDERS_KEY}:${userId}`);

      return res.json({
        success: true,
        message: 'Folder has been deleted successfully',
      });
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ success: false, message: 'Internal Server Error' });
    }
  },
);

// @route PUT api/folder/pin
// @desc Pin folder by folderId
// @access Private
router.put('/:folderId/pin', authorization.authorizeUser, async (req, res) => {
  const userId = req.user.id;
  const folderId = req.params.folderId;
  const { quickAccess } = req.body;

  try {
    await Folder.updateOne(
      { _id: folderId, author: userId },
      { quickAccess: quickAccess === undefined ? true : !quickAccess },
      { new: true },
    );

    redisClient.delWithKeyMatchPrefix(`${REDIS_FOLDERS_KEY}:${userId}`);

    res.json({
      success: true,
      message: 'Folder has been updated successfully',
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route GET api/folder/:folderId/detail
// @desc Get folder by folderId
// @access Private
router.get(
  '/:folderId/detail',
  authorization.authorizeUser,
  async (req, res) => {
    const folderId = req.params.folderId;

    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;
    const sortKey = req.query.sortKey || 'lastOpened';

    try {
      const queries = {
        parent_folder: new Types.ObjectId(folderId),
        isDelete: false,
      };

      const sort = { [sortKey]: -1 };

      const folderData = await getFolderWithQuery(queries, sort, skip, limit);

      const updateFolder = Folder.findOneAndUpdate(
        { _id: folderId },
        { lastOpened: Date.now() },
      );

      const folderLocation = genFolderLocation(folderId);

      const data = await Promise.all([
        folderData,
        updateFolder,
        folderLocation,
      ]);

      const folders = data[0];
      const location = [
        ...data[2].reverse(),
        { _id: data[1]._id, name: data[1].name },
      ];

      res.json({ success: true, data: folders, location: location });
    } catch (error) {
      console.log(error);
      return res
        .status(500)
        .json({ success: false, message: 'Internal Server Error' });
    }
  },
);

// @route GET api/folder
// @desc Get folder by userId
// @access Private
router.get('/', authorization.authorizeUser, async (req, res) => {
  const userId = req.user.id;

  const limit = parseInt(req.query.limit) || 20;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * limit;
  const sortKey = req.query.sortKey || 'lastOpened';

  try {
    const cachedFolders = await redisClient.getValue(
      `${REDIS_FOLDERS_KEY}:${userId}:${page}`,
    );

    if (cachedFolders) {
      return res.json({ success: true, data: JSON.parse(cachedFolders) });
    }

    const queries = {
      author: new Types.ObjectId(userId),
      parent_folder: null,
      isDelete: false,
    };

    const sort = { [sortKey]: -1 };

    const folders = await getFolderWithQuery(queries, sort, skip, limit);

    redisClient.setValue(
      `${REDIS_FOLDERS_KEY}:${userId}:${page}`,
      JSON.stringify(folders),
    );

    res.json({ success: true, data: folders });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route GET api/folder/quick-access
// @desc Get quick access folder by userId
// @access Private
router.get('/quick-access', authorization.authorizeUser, async (req, res) => {
  const userId = req.user.id;

  const limit = parseInt(req.query.limit) || 20;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * limit;
  const sortKey = req.query.sortKey || 'lastOpened';

  try {
    const queries = {
      author: new Types.ObjectId(userId),
      parent_folder: null,
      isDelete: false,
      quickAccess: true,
    };

    const sort = { [sortKey]: -1 };

    const folders = await getFolderWithQuery(queries, sort, skip, limit);

    res.json({ success: true, data: folders });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route GET api/folder/starred
// @desc Get folder that was starred by folderId
// @access Private
router.get('/starred', authorization.authorizeUser, async (req, res) => {
  const userId = req.user.id;

  const limit = parseInt(req.query.limit) || 20;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * limit;
  const sortKey = req.query.sortKey || 'lastOpened';

  try {
    const queries = {
      author: new Types.ObjectId(userId),
      isStar: true,
      isDelete: false,
    };

    const sort = { [sortKey]: -1 };

    const folders = await getFolderWithQuery(queries, sort, skip, limit);

    res.json({ success: true, data: folders });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route GET api/folder/trash
// @desc Get folder that was deleted by folderId
// @access Private
router.get('/trash', authorization.authorizeUser, async (req, res) => {
  const userId = req.user.id;

  const limit = parseInt(req.query.limit) || 20;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * limit;
  const sortKey = req.query.sortKey || 'lastOpened';

  try {
    const queries = {
      author: new Types.ObjectId(userId),
      isDelete: true,
    };

    const sort = { [sortKey]: -1 };

    const folders = await getFolderWithQuery(queries, sort, skip, limit);

    res.json({ success: true, data: folders });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// get folder size
const getFolderSize = async (folderId) => {
  try {
    let totalSize = 0;

    // Get the folder by its ID
    const folder = await Folder.findById(folderId).populate('sub_folder files');

    // Calculate the size of files in the current folder
    for (const file of folder.files) {
      totalSize += file.size;
    }

    // Calculate the size of sub-folders recursively
    for (const subFolder of folder.sub_folder) {
      totalSize += await getFolderSize(subFolder._id);
    }

    return totalSize;
  } catch (error) {
    throw error;
  }
};

// @route GET api/folder/shared
// @desc Get folder that was shared by email
// @access Private
router.get('/shared', authorization.authorizeUser, async (req, res) => {
  const email = req.user.email;

  const limit = parseInt(req.query.limit) || 20;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * limit;
  const sortKey = req.query.sortKey || 'lastOpened';

  try {
    const queries = {
      sharedTo: email,
    };

    const sort = { [sortKey]: -1 };

    const folders = await getFolderWithQuery(queries, sort, skip, limit);

    res.json({ success: true, data: folders });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route GET api/folder/sharedByMe
// @desc Get folder that was shared by Me
// @access Private
router.get('/sharedByMe', authorization.authorizeUser, async (req, res) => {
  const uid = req.user.id;

  const limit = parseInt(req.query.limit) || 20;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * limit;
  const sortKey = req.query.sortKey || 'lastOpened';

  try {
    const queries = {
      author: new Types.ObjectId(uid),
      sharedTo: {
        $exists: true,
        $ne: [],
      },
    };

    const sort = { [sortKey]: -1 };

    const folders = await getFolderWithQuery(queries, sort, skip, limit);

    res.json({ success: true, data: folders });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

module.exports = router;
