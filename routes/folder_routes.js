const express = require('express');
const router = express.Router();
const { Types } = require('mongoose');

const Folder = require('../models/Folder');
const File = require('../models/File');
const authorization = require('../middlewares/authorization');
const { IncFolderSize, GenFolderLocation } = require('../helpers/FolderHelper');
const { getFolderWithQuery } = require('../controllers/folder');

// @route POST api/folder
// @desc Create new folder
// @access Private
router.post('/', authorization.authorizeUser, async (req, res) => {
  const { name, parent_folder, sub_folder, files } = req.body;
  const author = req.data.id;

  if (!name)
    return res.status(400).json({
      success: false,
      message: 'Oops! It looks like some data of your request is missing',
    });

  try {
    if (!author)
      return res.status(403).json({
        success: false,
        message: 'You are not authorized or token was expired',
      });

    const createFolder = new Folder({
      name,
      author,
      parent_folder: parent_folder._id ? parent_folder._id : null,
      owner: parent_folder.owner ? parent_folder.owner : author,
      sub_folder,
      files,
    });

    await createFolder.save();

    if (parent_folder._id) {
      await Folder.updateOne(
        { _id: parent_folder._id },
        {
          $push: { sub_folder: createFolder._id },
          $inc: { size: createFolder.size ? createFolder.size : 0 },
          $set: { modifiedAt: Date.now() },
        },
      );
    }

    res.json({
      success: true,
      message: 'Folder has been created successfully',
      data: createFolder,
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route POST api/folder/quick-access
// @desc Create new folder with quick access property
// @access Private
router.post('/', authorization.authorizeUser, async (req, res) => {
  const { name, parent_folder, sub_folder, files } = req.body;
  const author = req.data.id;

  if (!name)
    return res.status(400).json({
      success: false,
      message: 'Oops! It looks like some data of your request is missing',
    });

  try {
    if (!author)
      return res.status(403).json({
        success: false,
        message: 'You are not authorized or token was expired',
      });

    const createFolder = new Folder({
      name,
      author,
      parent_folder: parent_folder._id ? parent_folder._id : null,
      owner: parent_folder.owner ? parent_folder.owner : author,
      quickAccess: true,
      sub_folder,
      files,
    });

    await createFolder.save();

    if (parent_folder._id) {
      await Folder.updateOne(
        { _id: parent_folder._id },
        {
          $push: { sub_folder: createFolder._id },
          $inc: { size: createFolder.size ? createFolder.size : 0 },
          $set: { modifiedAt: Date.now() },
        },
      );
    }

    res.json({
      success: true,
      message: 'Folder has been created successfully',
      data: createFolder,
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route POST api/folder/copy
// @desc Copy folder by folderId
// @access Private
router.post('/copy', authorization.authorizeUser, async (req, res) => {
  const userId = req.data.id;
  const { data, folderId } = req.body;

  try {
    if (
      data.author._id !== userId &&
      (!data.sharedTo.includes(email) ||
        !data.permission.includes(process.env.PERMISSION_EDIT))
    )
      return res.status(400).json({
        success: false,
        message: 'You do not have permission to do this',
      });

    const {
      _id,
      sharedTo,
      permission,
      createAt,
      modifiedAt,
      lastOpened,
      ...copyFolderData
    } = data;

    const copyFolder = new Folder({
      ...copyFolderData,
      author: userId,
      isStar: false,
      isDelete: false,
    });

    if (!folderId) {
      copyFolder.parent_folder = null;

      await copyFolder.save();
      return res.json({
        success: true,
        message: 'Folder has been copied successfully',
        data: copyFolder,
      });
    }

    const newParentFolder = await Folder.findOne({
      _id: folderId,
      author: userId,
    });

    if (!newParentFolder)
      return res
        .status(404)
        .json({ success: false, message: 'Destination folder not found' });

    copyFolder.parent_folder = newParentFolder._id;
    copyFolder.owner = newParentFolder.owner;

    const copiedFolder = await copyFolder.save();
    await Folder.updateOne(
      { _id: folderId, author: userId },
      {
        $push: { sub_folder: copiedFolder._id },
        $set: { modifiedAt: Date.now() },
      },
      { new: true },
    );

    await IncFolderSize(folderId, copiedFolder.size);

    res.json({
      status: true,
      message: 'Folder has been copied successfully',
      data: copyFolder,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route POST api/folder/move
// @desc Move folder by folderId
// @access Private
router.post('/move', authorization.authorizeUser, async (req, res) => {
  const userId = req.data.id;
  const { data, folderId } = req.body;

  try {
    if (data.author !== userId)
      return res.status(400).json({
        success: false,
        message: 'You do not have permission to do this',
      });

    const bulkOps = [];

    if (!folderId) {
      // Remove folder from old parent folder and update new parent_folder
      bulkOps.push(
        {
          updateOne: {
            filter: { _id: data.parent_folder, author: userId },
            update: {
              $pull: { sub_folder: data._id },
              $set: { modifiedAt: Date.now() },
              $inc: { size: -data.size },
            },
          },
        },
        {
          updateOne: {
            filter: { _id: data._id, author: userId },
            update: { parent_folder: null },
          },
        },
      );
    } else {
      const newParentFolder = await Folder.findOne({
        _id: folderId,
        author: userId,
      }).lean();

      if (!newParentFolder)
        return res
          .status(404)
          .json({ success: false, message: 'Destination folder not found' });

      const oldParentFolderId = data.parent_folder;

      if (oldParentFolderId) {
        // Remove folder from old parent folder
        bulkOps.push({
          updateOne: {
            filter: { _id: oldParentFolderId, author: userId },
            update: {
              $pull: { sub_folder: data._id },
              $set: { modifiedAt: Date.now() },
              $inc: { size: -data.size },
            },
          },
        });
      }

      // Add folder to new parent folder and update new parent_folder
      bulkOps.push(
        {
          updateOne: {
            filter: { _id: folderId, author: userId },
            update: {
              $push: { sub_folder: data._id },
              $set: { modifiedAt: Date.now() },
              $inc: { size: data.size },
            },
          },
        },
        {
          updateOne: {
            filter: { _id: data._id, author: userId },
            update: { parent_folder: folderId, owner: newParentFolder.owner },
          },
        },
      );
    }

    if (bulkOps.length > 0) {
      await Folder.bulkWrite(bulkOps);
    }

    res.json({
      status: true,
      message: 'Folder has been moved successfully',
      data: data,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route DELETE api/folder/delete
// @desc Delete folder by folderId
// @access Private
router.post('/delete', authorization.authorizeUser, async (req, res) => {
  const userId = req.data.id;
  const folderId = req.body.folderId;
  const folderDeleteArray = [];

  try {
    // Find the folder to delete
    const folderExists = await Folder.findOne({
      _id: folderId,
      author: userId,
    });

    if (!folderExists) {
      return res.status(404).json({
        success: false,
        message:
          'Folder does not exist or you do not have permission to delete it',
      });
    }

    // Fetch the parent folder (if it exists) and update it
    if (folderExists.parent_folder) {
      await Folder.updateOne(
        { _id: folderExists.parent_folder },
        {
          $pull: { sub_folder: folderExists._id },
          $set: { modifiedAt: Date.now() },
          $inc: { size: -folderExists.size },
        },
      );
    }

    // Populate the folderDeleteArray
    folderDeleteArray.push(folderExists._id);
    await findAllSubFolder(folderId, folderDeleteArray);

    // Fetch files associated with the target folders
    const filesToDelete = await File.find({
      parent_folder: { $in: folderDeleteArray },
    });

    // Delete files from the Google Cloud Storage
    if (filesToDelete.length > 0) {
      await Promise.all(
        filesToDelete.map(async (fileData) => {
          const gcFileName = `${fileData.name}_${userId}`;
          return gcDeleteFile(gcFileName);
        }),
      );
    }

    // Delete all folders and associated files using Promise.all
    await Promise.all([
      Folder.deleteMany({ _id: { $in: folderDeleteArray } }),
      File.deleteMany({ parent_folder: { $in: folderDeleteArray } }),
    ]);

    return res.json({
      success: true,
      message: 'Folder and associated files have been deleted successfully',
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

const findAllSubFolder = async (rootFolderId, folderDeleteArray) => {
  try {
    const subFolders = await Folder.find({ parent_folder: rootFolderId });

    if (subFolders.length > 0) {
      for (const folder of subFolders) {
        folderDeleteArray.push(folder._id);
        await findAllSubFolder(folder._id, folderDeleteArray);
      }
    }
  } catch (error) {
    console.error(error);
  }
};

const gcDeleteFile = async (fileName) => {
  try {
    await bucket.file(`files/${fileName}`).delete();
  } catch (error) {
    throw error;
  }
};

// @route POST api/folder/mutiple-delete
// @desc Delete multiple folders by folder list
// @access Private
router.post(
  '/multiple-delete',
  authorization.authorizeUser,
  async (req, res) => {
    const userId = req.data.id;
    const folders = req.body.folders;
    const folderIdsToDelete = folders.map((folder) => folder._id);

    try {
      const targetFolders = await Folder.find({
        _id: { $in: folderIdsToDelete },
        author: userId,
      });

      const allFolderIdsToDelete = [];

      targetFolders.forEach((folder) => {
        allFolderIdsToDelete.push(folder._id);
        findAllSubFolder(folder._id, allFolderIdsToDelete);
      });

      const filesToDelete = await File.find({
        parent_folder: { $in: allFolderIdsToDelete },
      });

      if (filesToDelete.length > 0) {
        await Promise.all(
          filesToDelete.map(async (fileData) => {
            const gcFileName = `${fileData.name}_${userId}`;
            return gcDeleteFile(gcFileName);
          }),
        );
      }

      await Promise.all([
        Folder.deleteMany({ _id: { $in: allFolderIdsToDelete } }),
        File.deleteMany({ parent_folder: { $in: allFolderIdsToDelete } }),
      ]);

      res.json({
        success: true,
        message: 'Folders and associated files have been deleted successfully',
      });
    } catch (error) {
      console.log(error);
      return res
        .status(500)
        .json({ success: false, message: 'Internal Server Error' });
    }
  },
);

// @route POST api/folder/share
// @desc Share folder by folderId to emails
// @access Private
router.post('/share', authorization.authorizeUser, async (req, res) => {
  const userId = req.data.id;
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

    res.json({ success: true, message: 'Folder has been shared successfully' });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route PUT api/folder/:folderId/restore
// @desc Restore folder by folderId
// @access Private
router.put(
  '/:folderId/restore',
  authorization.authorizeUser,
  async (req, res) => {
    const userId = req.data.id;
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
    const userId = req.data.id;
    const folders = req.body.folders;
    const folderIdsToRestore = folders.map((folder) => folder._id);

    try {
      await Folder.updateMany(
        { _id: { $in: folderIdsToRestore }, author: userId },
        { isDelete: false, modifiedAt: Date.now() },
        { new: true },
      );

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
  const userId = req.data.id;
  const email = req.data.email;

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
  const userId = req.data.id;
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
  const userId = req.data.id;
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
    const userId = req.data.id;
    const folderIdList = req.body.folderIdList;

    try {
      await Folder.updateMany(
        { _id: { $in: folderIdList }, author: userId },
        { isStar: false },
        { new: true },
      );

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
    const userId = req.data.id;
    const email = req.data.email;
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
  const userId = req.data.id;
  const folderId = req.params.folderId;
  const { quickAccess } = req.body;

  try {
    await Folder.updateOne(
      { _id: folderId, author: userId },
      { quickAccess: quickAccess === undefined ? true : !quickAccess },
      { new: true },
    );

    console.log(quickAccess);

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

      const folderLocation = GenFolderLocation(folderId);

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
  const userId = req.data.id;

  const limit = parseInt(req.query.limit) || 20;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * limit;
  const sortKey = req.query.sortKey || 'lastOpened';

  try {
    const queries = {
      author: new Types.ObjectId(userId),
      parent_folder: null,
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

// @route GET api/folder/quick-access
// @desc Get quick access folder by userId
// @access Private
router.get('/quick-access', authorization.authorizeUser, async (req, res) => {
  const userId = req.data.id;

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
  const userId = req.data.id;

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
  const userId = req.data.id;

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
  const email = req.data.email;

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

module.exports = router;
