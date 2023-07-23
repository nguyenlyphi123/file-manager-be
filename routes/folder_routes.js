const express = require('express');
const router = express.Router();

const Folder = require('../models/Folder');
const File = require('../models/File');
const authorization = require('../middlewares/authorization');

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
      parent_folder,
      sub_folder,
      files,
    });

    await createFolder.save();

    if (parent_folder) {
      await Folder.updateOne(
        { _id: parent_folder },
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
    const { _id, ...copyFolderData } = data;

    const copyFolder = new Folder({
      ...copyFolderData,
      author: userId,
      isStar: false,
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

    const copiedFolder = await copyFolder.save();
    await Folder.updateOne(
      { _id: folderId, author: userId },
      {
        $push: { sub_folder: copiedFolder._id },
        $inc: { size: copiedFolder.size ? copiedFolder.size : 0 },
        $set: { modifiedAt: Date.now() },
      },
      { new: true },
    );

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
            update: { parent_folder: folderId },
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

// @route PUT api/folder/:folderId
// @desc Update folder by folderId
// @access Private
router.put('/:folderId', authorization.authorizeUser, async (req, res) => {
  const folderId = req.params.folderId;

  const { name, parent_folder } = req.body;

  try {
    const folderBeforeChange = await Folder.findOne({
      _id: folderId,
      author: req.data.id,
    });

    if (!folderBeforeChange)
      return res
        .status(403)
        .json({ success: false, message: 'You are not authorized to do this' });

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
    await Folder.findOneAndUpdate(
      { _id: folderId, author: userId },
      { isStar: true },
      { new: true },
    );

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
    await Folder.findOneAndUpdate(
      { _id: folderId, author: userId },
      { isStar: false },
      { new: true },
    );

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
    const folderId = req.params.folderId;
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
            'Folder does not exists or you are not permission to do this',
        });
      }

      // Populate the folderDeleteArray
      folderDeleteArray.push(folderExists._id);
      await findAllSubFolder(folderId, folderDeleteArray);

      // Delete all folders using Promise.all
      const promises = folderDeleteArray.map(async (id) => {
        try {
          await Folder.findByIdAndUpdate(
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
          await Folder.findByIdAndUpdate(
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

// @route DELETE api/folder/:folderId
// @desc Delete folder by folderId
// @access Private
router.delete('/:folderId', authorization.authorizeUser, async (req, res) => {
  const userId = req.data.id;
  const folderId = req.params.folderId;
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
        message: 'Folder does not exists or you are not permission to do this',
      });
    }

    if (folderExists.parent_folder) {
      await Folder.findOneAndUpdate(
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

    // Delete all folders using Promise.all
    const promises = [
      Folder.deleteMany({ _id: { $in: folderDeleteArray } }),
      File.deleteMany({ parent_folder: { $in: folderDeleteArray } }),
    ];

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

// @route GET api/folder/:folderId/detail
// @desc Get folder by folderId
// @access Private
router.get(
  '/:folderId/detail',
  authorization.authorizeUser,
  async (req, res) => {
    const folderId = req.params.folderId;

    try {
      const folders = await Folder.find({
        parent_folder: folderId,
        isDelete: false,
      })
        .populate('parent_folder')
        .populate('sub_folder')
        .populate('files');

      if (!folders)
        return res
          .status(404)
          .json({ success: false, message: 'Folder not found' });

      await Folder.findOneAndUpdate(
        { _id: folderId },
        { lastOpened: Date.now() },
      );

      res.json({ success: true, data: folders });
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

  try {
    const folders = await Folder.find({
      author: userId,
      parent_folder: null,
      isDelete: false,
    })
      .populate('parent_folder')
      .populate('sub_folder')
      .populate('files');

    if (!folders)
      return res
        .status(404)
        .json({ success: false, message: 'Folder not found' });

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

  try {
    const folders = await Folder.find({
      author: userId,
      isStar: true,
      isDelete: false,
    })
      .populate('parent_folder')
      .populate('sub_folder')
      .populate('files');

    if (!folders)
      return res
        .status(404)
        .json({ success: false, message: 'No folders are stared' });

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

  try {
    const folders = await Folder.find({ author: userId, isDelete: true })
      .populate('parent_folder')
      .populate('sub_folder')
      .populate('files');

    if (!folders)
      return res
        .status(404)
        .json({ success: false, message: 'No folder was deleted' });

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

module.exports = router;
