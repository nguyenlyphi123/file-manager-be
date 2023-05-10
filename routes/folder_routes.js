const express = require('express');
const router = express.Router();

const Folder = require('../models/Folder');
const authorization = require('../middlewares/authorization');

// @route POST api/folder
// @desc Create new folder
// @access Private
router.post('/', authorization.authorizeUser, async (req, res) => {
  const { name, parent_folder, sub_folder, files } = req.body;

  if (!name)
    return res.status(400).json({
      success: false,
      message: 'Oops! It looks like some data of your request is missing',
    });

  try {
    const folderExists = await Folder.findOne({ name });

    if (folderExists)
      return res
        .status(400)
        .json({ success: false, message: 'Folder is already exists' });

    const author = req.data.id;

    const createFolder = new Folder({
      name,
      author,
      parent_folder,
      sub_folder,
      files,
    });

    await createFolder.save().then(async (folder) => {
      if (folder.parent_folder) {
        try {
          const parentFolder = await Folder.findById(folder.parent_folder);

          let subFolder = parentFolder.sub_folder;
          subFolder.push(folder._id);

          await Folder.findOneAndUpdate(
            { _id: parentFolder._id },
            {
              sub_folder: subFolder,
            },
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

    const updateData = { name, parent_folder };

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

// @route GET api/folder/:folderId
// @desc Get folder by folderId
// @access Private
router.get('/:folderId', authorization.authorizeUser, async (req, res) => {
  const folderId = req.params.folderId;

  try {
    const folderExists = await Folder.findById(folderId)
      .populate('parent_folder')
      .populate('sub_folder');
    //   .populate('files');

    if (!folderExists)
      return res
        .status(404)
        .json({ success: false, message: 'Folder not found' });

    res.json({ success: true, data: folderExists });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route GET api/folder/:userId
// @desc Get folder by userId
// @access Private
router.get('/user/:userId', authorization.authorizeUser, async (req, res) => {
  const userId = req.params.userId;

  if (req.data.id !== userId)
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to do this',
    });

  try {
    const folderExists = await Folder.findOne({ author: userId })
      .populate('parent_folder')
      .populate('sub_folder');
    //   .populate('files');

    if (!folderExists)
      return res
        .status(404)
        .json({ success: false, message: 'Folder not found' });

    res.json({ success: true, data: folderExists });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

module.exports = router;
