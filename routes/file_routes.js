const express = require('express');
const router = express.Router();
const { authorizeUser } = require('../middlewares/authorization');

const File = require('../models/File');
const Folder = require('../models/Folder');

// @route POST api/file
// @desc Create new file
// @access Private
router.post('/', authorizeUser, async (req, res) => {
  const { name, type, size, parent_folder, isStar } = req.body;

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

    const author = req.data.id;

    const createFile = new File({
      name,
      type,
      size,
      parent_folder,
      author,
      isStar,
    });

    await createFile.save().then(async (file) => {
      if (file.parent_folder) {
        try {
          const parentFolder = await Folder.findById(file.parent_folder);

          let files = parentFolder.files;
          files.push(file._id);

          await Folder.findOneAndUpdate(
            { _id: parentFolder._id },
            { files: files },
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

module.exports = router;
