const express = require('express');
const router = express.Router();
const { authorizeUser } = require('../middlewares/authorization');

const storage = require('../config/googleStorage');

const File = require('../models/File');
const Folder = require('../models/Folder');

const bucket = storage.bucket(process.env.GCLOUD_BUCKET_NAME);

// @route POST api/file
// @desc Create new file
// @access Private
router.post('/', authorizeUser, async (req, res) => {
  const { name, type, size, parent_folder, link } = req.body;
  const author = req.data.id;

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
    });

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
  const userId = req.data.id;
  const email = req.data.email;
  const { data, folderId } = req.body;

  try {
    if (
      data.author !== userId &&
      (!data.sharedTo.includes(email) ||
        !data.permission.includes(process.env.PERMISSION_EDIT))
    )
      return res.status(400).json({
        success: false,
        message: 'You do not have permission to do this',
      });

    const currentName = `${data.name}_${userId}`;
    let destName = currentName;

    const nameExists = await File.find({ name: data.name, author: userId });

    if (nameExists.length > 0) {
      const name = data.name;
      data.name = `${name} (${nameExists.length})`;
      destName = `${name} (${nameExists.length})_${userId}`;
    }

    const copyFile = new File({
      name: data.name,
      type: data.type,
      size: data.size,
      parent_folder: folderId,
      link: data.link,
      author: userId,
    });

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
  const userId = req.data.id;
  const { data, folderId } = req.body;

  try {
    if (data.author !== userId)
      return res.status(400).json({
        success: false,
        message: 'You do not have permission to do this',
      });

    const newParentFolder = await Folder.findOne({
      _id: folderId,
      author: userId,
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
        { parent_folder: newParentFolder._id },
      ),
      Folder.findByIdAndUpdate(data.parent_folder, {
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
  const userId = req.data.id;
  const { fileData } = req.body;

  try {
    await File.deleteOne({ _id: fileData._id, author: userId });
    if (fileData.parent_folder) {
      await Folder.findByIdAndUpdate(fileData.parent_folder, {
        $pull: { files: fileData._id },
        $inc: { size: -fileData.size },
        $set: { modifiedAt: Date.now() },
      });
    }

    const gcFileName = `${fileData.name}_${userId}`;

    await gcDeleteFile(gcFileName);

    res.json({ success: true, message: 'File has been deleted successfully' });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

const gcDeleteFile = async (fileName) => {
  try {
    await bucket.file(fileName).delete();
  } catch (error) {
    throw error;
  }
};

// @route POST api/file/multiple-delete
// @desc Delete multiple files
// @access Private
router.post('/multiple-delete', authorizeUser, async (req, res) => {
  const userId = req.data.id;
  const { files } = req.body;

  try {
    const promises = files.map(async (file) => {
      await File.deleteOne({ _id: file._id, author: userId });
      if (file.parent_folder) {
        await Folder.findByIdAndUpdate(file.parent_folder, {
          $pull: { files: file._id },
          $inc: { size: -file.size },
          $set: { modifiedAt: Date.now() },
        });
      }

      const gcFileName = `${file.name}_${userId}`;

      return await gcDeleteFile(gcFileName);
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
  const userId = req.data.id;
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

// @route PUT api/file/:id/star
// @desc Star file by fileId
// @access Private
router.put('/:id/star', authorizeUser, async (req, res) => {
  const userId = req.data.id;
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
      { isStar: true },
    );

    res.json({
      success: true,
      message: 'File has been starred successfully',
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
  const userId = req.data.id;
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
  const userId = req.data.id;
  const { files } = req.body;

  try {
    const promises = files.map(async (file) => {
      return await File.findOneAndUpdate(
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
  const userId = req.data.id;
  const email = req.data.email;
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
  const userId = req.data.id;
  const email = req.data.email;
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
  const userId = req.data.id;
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
  const userId = req.data.id;
  const { files } = req.body;

  try {
    const promises = files.map(async (file) => {
      return await File.updateOne(
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
  const userId = req.data.id;

  try {
    const files = await File.find({ author: userId, isDelete: false }).populate(
      'parent_folder',
    );

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

// @route GET api/file/trash
// @desc Get all trashed files
// @access Private
router.get('/trash', authorizeUser, async (req, res) => {
  const userId = req.data.id;

  try {
    const files = await File.find({ author: userId, isDelete: true }).populate(
      'parent_folder',
    );

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
router.get('/star', authorizeUser, async (req, res) => {
  const userId = req.data.id;
  try {
    const files = await File.find({ author: userId, isStar: true }).populate(
      'parent_folder',
    );

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
  const email = req.data.email;

  try {
    const files = await File.find({
      sharedTo: { $elemMatch: { $eq: email } },
    }).populate('parent_folder');

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
  const userId = req.data.id;
  const folderId = req.params.id;

  try {
    const files = await File.find({
      parent_folder: folderId,
      author: userId,
      isDelete: false,
    });

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

module.exports = router;
