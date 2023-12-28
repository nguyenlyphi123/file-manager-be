const express = require('express');
const router = express.Router();
const { Types } = require('mongoose');
const { authorizeUser } = require('../middlewares/authorization');

const storage = require('../config/googleStorage');

const File = require('../models/File');
const Folder = require('../models/Folder');
const Require = require('../models/Require');
const { descFolderSize } = require('../helpers/folder.helper');
const { fileResponseEx } = require('../types/file');
const { getFileWithQuery } = require('../controllers/file');
const { isAuthor } = require('../helpers/AuthHelper');

const GcService = require('../services/gc.service');

const bucket = storage.bucket(process.env.GCLOUD_BUCKET_NAME);

// @route POST api/file
// @desc Create new file
// @access Private
router.post('/', authorizeUser, async (req, res) => {
  const { name, type, size, parent_folder, link } = req.body;
  const author = req.user.id;

  if (!name)
    return res.status(400).json({
      success: false,
      message: 'Oops! It looks like some data of your request is missing',
    });

  try {
    const fileExists = await File.findOne({ name, parent_folder });

    if (fileExists)
      return res
        .status(400)
        .json({ success: false, message: 'File is already exists' });

    const createFile = new File({
      name,
      type,
      size,
      parent_folder,
      author,
      link,
      owner: author,
    });

    if (parent_folder) {
      const parentFolder = await Folder.findById(parent_folder);

      console.log(parentFolder);

      if (parentFolder && parentFolder.owner) {
        createFile.owner = parentFolder.owner;
      }
    }

    await createFile.save().then(async (file) => {
      if (file.parent_folder) {
        try {
          await Folder.findOne(
            { _id: file.parent_folder },
            { $push: { files: file._id }, $inc: { size: file.size } },
            { new: true },
          );
        } catch (error) {
          console.log(error);
          return;
        }
      }
    });

    res.json({
      success: true,
      message: 'File has been created successfully',
      data: createFile,
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route POST api/file/copy
// @desc Copy file
// @access Private
router.post('/copy', authorizeUser, async (req, res) => {
  const userId = req.user.id;
  const email = req.user.email;
  const { data, folderId } = req.body;

  try {
    if (
      data.author !== userId &&
      data.parent_folder.owner !== userId &&
      (!data.sharedTo.includes(email) ||
        !data.permission.includes(process.env.PERMISSION_EDIT))
    )
      return res.status(400).json({
        success: false,
        message: 'You do not have permission to do this',
      });

    const fileExists = await File.findOne({ name: data.name, parent_folder });

    if (fileExists) {
      return res.json({ success: false, message: 'File is already exists' });
    }

    const fileName = data.name.split(' ')[0];
    const fileNum = data.name.split(' ')[1];

    const currentName = `${fileName}_${data.author}_${data.parent_folder._id}${
      fileNum ? ` ${fileNum}` : ''
    }`;

    let destName = `${fileName}_${userId}_${folderId}${
      fileNum ? ` ${fileNum}` : ''
    }`;

    const copyFile = new File({
      name: data.name,
      type: data.type,
      size: data.size,
      parent_folder: folderId,
      link: data.link,
      author: userId,
      owner: data.owner,
    });

    if (folderId) {
      const parentFolder = await Folder.findById(folderId);

      if (parentFolder && parentFolder.owner) {
        copyFile.owner = parentFolder.owner;
      }
    }

    const copiedFile = await copyFile.save();
    await gcCopyFile(currentName, destName);

    if (copiedFile.parent_folder) {
      await Folder.updateOne(
        { _id: folderId, author: userId },
        { $push: { files: copiedFile._id }, $inc: { size: copiedFile.size } },
      );
    }

    res.json({ success: true, message: 'File has been copied successfully' });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

const gcCopyFile = async (fileName, destName) => {
  try {
    const copyDest = bucket.file(destName);
    await bucket.file(fileName).copy(copyDest);
  } catch (error) {
    throw error;
  }
};

// @route POST api/file/move
// @desc Move file
// @access Private
router.post('/move', authorizeUser, async (req, res) => {
  const userId = req.user.id;
  const { data, folderId } = req.body;

  try {
    if (data.author !== userId && data.parent_folder.owner !== userId)
      return res.status(400).json({
        success: false,
        message: 'You do not have permission to do this',
      });

    const newParentFolder = await Folder.findOne({
      _id: folderId,
      $or: [{ author: userId }, { owner: userId }],
    });

    if (!newParentFolder)
      return res
        .status(404)
        .json({ success: false, message: 'Destination folder not found' });

    // Update the file's parent_folder field and remove the file from the old parent folder's files array
    // Add the file to the new parent folder's files array using Promise.all
    await Promise.all([
      File.updateOne(
        { _id: data._id, author: userId },
        {
          parent_folder: newParentFolder._id,
          owner: newParentFolder.owner ? newParentFolder.owner : userId,
        },
      ),
      Folder.findByIdAndUpdate(data.parent_folder._id, {
        $pull: { files: data._id },
        $inc: { size: -data.size },
        $set: { modifiedAt: Date.now() },
      }),
      Folder.findByIdAndUpdate(folderId, {
        $push: { files: data._id },
        $inc: { size: data.size },
        $set: { modifiedAt: Date.now() },
      }),
    ]);

    return res.json({
      success: true,
      message: 'File has been moved successfully',
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route POST api/file
// @desc Delete file by fileId
// @access Private
router.post('/delete', authorizeUser, async (req, res) => {
  const userId = req.user.id;
  const { fileData } = req.body;

  try {
    let params = {
      _id: fileData._id,
      author: userId,
    };

    if (fileData.parent_folder && fileData.parent_folder.owner) {
      if (userId === fileData.parent_folder.owner.toString()) {
        params = {
          _id: fileData._id,
        };
      }
    }

    await File.deleteOne(params);

    if (fileData.parent_folder) {
      const updateFolderPromise = Folder.findByIdAndUpdate(
        fileData.parent_folder._id,
        {
          $pull: { files: fileData._id },
          $set: { modifiedAt: Date.now() },
        },
      );

      const descFolderSizePromise = descFolderSize(
        fileData.parent_folder._id,
        fileData.size,
      );

      await Promise.all([updateFolderPromise, descFolderSizePromise]);
    }

    if (
      fileData.parent_folder?.isRequireFolder &&
      !isAuthor(userId, fileData.parent_folder.owner)
    ) {
      await Require.findOne({
        folder: fileData.parent_folder._id,
      })
        .exec()
        .then(async (require) => {
          await require.updateStatus({
            accountId: fileData.author._id,
            memStatus: process.env.REQ_STATUS_PROCESSING,
          });
          await require.removeSent(fileData.author._id);
        })
        .catch((err) => console.log(err));
    }

    const regex = /^(.*?)\s*(\(.+?\))$/;
    const match = fileData.name.match(regex);

    const fileName = match ? match[1].trim() : fileData.name.trim();
    const fileNum = match ? `(${match[2]})` : null;

    let gcFileName = `${fileName}_${fileData.author._id}${
      fileData.parent_folder ? `_${fileData.parent_folder._id}` : ''
    }`;

    if (fileNum) {
      gcFileName = `${fileName}_${userId}${
        fileData.parent_folder ? `_${fileData.parent_folder._id}` : ''
      } ${fileNum}`;
    }

    await GcService.deleteFile(`files/${gcFileName}`);

    res.json({ success: true, message: 'File has been deleted successfully' });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route POST api/file/multiple-delete
// @desc Delete multiple files
// @access Private
router.post('/multiple-delete', authorizeUser, async (req, res) => {
  const userId = req.user.id;
  const { files } = req.body;

  try {
    const promises = files.map(async (file) => {
      await File.deleteOne({ _id: file._id, author: userId });
      if (file.parent_folder) {
        const updateFolderPromise = Folder.findByIdAndUpdate(
          fileData.parent_folder._id,
          {
            $pull: { files: fileData._id },
            $set: { modifiedAt: Date.now() },
          },
        );

        const descFolderSizePromise = descFolderSize(
          fileData.parent_folder._id,
          fileData.size,
        );

        await Promise.all([updateFolderPromise, descFolderSizePromise]);
      }

      const fileName = file.name.split(' ')[0];
      const fileNum = file.name.split(' ')[1];

      let gcFileName = `${fileName}_${userId}${
        fileData.parent_folder ? `_${fileData.parent_folder}` : ''
      }`;

      if (fileNum) {
        gcFileName = `${fileName}_${userId}${
          fileData.parent_folder ? `_${fileData.parent_folder}` : ''
        } ${fileNum}`;
      }

      return await GcService.deleteFile(`files/${gcFileName}`);
    });

    await Promise.all(promises);
    res.json({
      success: true,
      message: 'Files have been deleted successfully',
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route POST api/file/share
// @desc Share file by fileId to emails
// @access Private
router.post('/share', authorizeUser, async (req, res) => {
  const userId = req.user.id;
  const { fileId, emails, permissions } = req.body;

  if (!fileId || !emails)
    return res.status(400).json({
      success: false,
      message: 'Oops! It looks like some data of your request is missing',
    });

  try {
    const file = await File.findOne({
      _id: fileId,
    });

    if (!file)
      return res
        .status(404)
        .json({ success: false, message: 'File not found' });

    if (!file.author.toString() === userId) {
      if (
        !file.sharedTo.includes(userId) &&
        !file.permission.includes(process.env.PERMISSION_SHARE)
      ) {
        return res.status(400).json({
          success: false,
          message: 'You do not have permission to do this',
        });
      }

      await Folder.updateOne(
        {
          _id: file,
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

    await File.updateOne(
      {
        _id: fileId,
      },
      {
        $addToSet: { sharedTo: emails, permission: permissions },
        $set: { modifiedAt: Date.now() },
      },
      { new: true },
    );

    res.json({ success: true, message: 'File has been shared successfully' });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route PUT api/file/star/:id
// @desc Star file by fileId
// @access Private
router.put('/star/:id', authorizeUser, async (req, res) => {
  const userId = req.user.id;
  const fileId = req.params.id;

  try {
    const file = await File.findOneAndUpdate(
      { _id: fileId, author: userId },
      [{ $set: { isStar: { $not: '$isStar' } } }],
      { new: true },
    );

    if (!file)
      return res.status(400).json({
        success: false,
        message: 'You do not have permission to do this',
      });

    res.json({
      success: true,
      message: 'File has been updated successfully',
      data: file,
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route PUT api/file/:id/unstar
// @desc Unstar file by fileId
// @access Private
router.put('/:id/unstar', authorizeUser, async (req, res) => {
  const userId = req.user.id;
  const fileId = req.params.id;

  try {
    const file = await File.findOne({ _id: fileId, author: userId });

    if (!file)
      return res.status(400).json({
        success: false,
        message: 'You do not have permission to do this',
      });

    await File.findOneAndUpdate(
      { _id: fileId, author: userId },
      { isStar: false },
    );

    res.json({
      success: true,
      message: 'File has been unstarred successfully',
      data: file,
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route PUT api/file/multiple-unstar
// @desc Unstar multiple files
// @access Private
router.put('/multiple-unstar', authorizeUser, async (req, res) => {
  const userId = req.user.id;
  const { files } = req.body;

  try {
    const promises = files.map(async (file) => {
      return File.findOneAndUpdate(
        { _id: file._id, author: userId },
        { isStar: false },
      );
    });

    await Promise.all(promises);
    res.json({
      success: true,
      message: 'Files have been unstarred successfully',
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route PUT api/file/rename
// @desc Rename file
// @access Private
router.put('/rename', authorizeUser, async (req, res) => {
  const userId = req.user.id;
  const email = req.user.email;
  const { fileData, name } = req.body;

  if (!name)
    return res.status(400).json({
      success: false,
      message: 'Oops! It looks like some data of your request is missing',
    });

  try {
    if (
      fileData.author !== userId &&
      (!fileData.sharedTo.includes(email) ||
        !fileData.permission.includes(process.env.PERMISSION_EDIT))
    ) {
      return res.status(400).json({
        success: false,
        message: 'You do not have permission to do this',
      });
    }

    await File.updateOne({ _id: fileData._id, author: userId }, { name });
    await gcRenameFile(fileData.name, name);

    res.json({ success: true, message: 'File has been renamed successfully' });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

const gcRenameFile = async (fileName, destFileName) => {
  try {
    await bucket.file(fileName).rename(destFileName);
  } catch (error) {
    throw error;
  }
};

// @route PUT api/file/trash
// @desc Trash file
// @access Private
router.put('/trash', authorizeUser, async (req, res) => {
  const userId = req.user.id;
  const email = req.user.email;
  const { fileId } = req.body;

  try {
    const file = await File.findOne({ _id: fileId });

    if (file.author.toString() !== userId) {
      if (file.sharedTo.includes(email)) {
        await File.updateOne({ _id: fileId }, { $pull: { sharedTo: email } });
        return res.json({
          success: true,
          message: 'File has been removed from your drive',
        });
      } else {
        return res.status(400).json({
          success: false,
          message: 'You do not have permission to do this',
        });
      }
    }

    await File.updateOne({ _id: fileId, author: userId }, { isDelete: true });

    res.json({
      success: true,
      message: 'File has been deleted successfully',
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route PUT api/file/restore
// @desc Restore file
// @access Private
router.put('/restore', authorizeUser, async (req, res) => {
  const userId = req.user.id;
  const { fileId } = req.body;

  try {
    await File.updateOne({ _id: fileId, author: userId }, { isDelete: false });

    res.json({ success: true, message: 'File has been restored successfully' });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route PUT api/file/multiple-restore
// @desc Restore multiple files
// @access Private
router.put('/multiple-restore', authorizeUser, async (req, res) => {
  const userId = req.user.id;
  const { files } = req.body;

  try {
    const promises = files.map(async (file) => {
      return File.updateOne(
        { _id: file._id, author: userId },
        { isDelete: false },
      );
    });

    await Promise.all(promises);
    res.json({
      success: true,
      message: 'Files have been restored successfully',
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route GET api/file
// @desc Get all files
// @access Private
router.get('/', authorizeUser, async (req, res) => {
  const userId = req.user.id;

  const limit = parseInt(req.query.limit) || 20;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * limit;
  const sortKey = req.query.sortKey || 'lastOpened';

  try {
    const queries = {
      author: new Types.ObjectId(userId),
      isDelete: false,
    };

    const sort = { [sortKey]: -1 };

    const files = await getFileWithQuery(queries, sort, skip, limit);

    res.json({ success: true, data: files });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route GET api/file/trash
// @desc Get all trashed files
// @access Private
router.get('/trash', authorizeUser, async (req, res) => {
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

    const files = await getFileWithQuery(queries, sort, skip, limit);

    if (!files)
      return res
        .status(404)
        .json({ success: false, message: 'Files not found' });

    res.json({ success: true, data: files });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route GET api/file/star
// @desc Get all starred files
// @access Private
router.get('/starred', authorizeUser, async (req, res) => {
  const userId = req.user.id;

  const limit = parseInt(req.query.limit) || 20;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * limit;
  const sortKey = req.query.sortKey || 'lastOpened';

  try {
    const queries = {
      author: new Types.ObjectId(userId),
      isStar: true,
    };
    const sort = { [sortKey]: -1 };

    const files = await getFileWithQuery(queries, sort, skip, limit);

    if (!files)
      return res
        .status(404)
        .json({ success: false, message: 'Files not found' });

    res.json({ success: true, data: files });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route GET api/file/shared
// @desc Get all shared files
// @access Private
router.get('/shared', authorizeUser, async (req, res) => {
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

    const files = await getFileWithQuery(queries, sort, skip, limit);

    res.json({ success: true, data: files });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route GET api/file/sharedByMe
// @desc Get all shared files by Me
// @access Private
router.get('/sharedByMe', authorizeUser, async (req, res) => {
  const uid = req.user.id;

  const limit = parseInt(req.query.limit) || 20;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * limit;
  const sortKey = req.query.sortKey || 'lastOpened';

  try {
    const queries = {
      author: new Types.ObjectId(uid),
      sharedTo: { $ne: [] },
    };
    const sort = { [sortKey]: -1 };

    const files = await getFileWithQuery(queries, sort, skip, limit);

    res.json({ success: true, data: files });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route GET api/file/:id
// @desc Get file by folderId
// @access Private
router.get('/:id', authorizeUser, async (req, res) => {
  const folderId = req.params.id;

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

    const files = await getFileWithQuery(queries, sort, skip, limit);

    res.json({ success: true, data: files });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

module.exports = router;
