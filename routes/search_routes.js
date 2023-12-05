const express = require('express');
const router = express.Router();

const { authorizeUser } = require('../middlewares/authorization');

const File = require('../models/File');
const Folder = require('../models/Folder');

// @GET /api/search/:name
// @desc search folder and file by name
// @access Private
router.get('/', authorizeUser, async (req, res) => {
  const uid = req.user.id;
  const name = req.query.name;
  const type = req.query.type;
  const action = req.query.action;

  try {
    const filePromise =
      type !== 'folder'
        ? File.find(
            type === 'all'
              ? {
                  name: { $regex: name, $options: 'i' },
                  $or: [{ owner: uid }, { shareWith: uid }],
                }
              : {
                  name: { $regex: name, $options: 'i' },
                  type: type,
                  $or: [{ owner: uid }, { shareWith: uid }],
                },
          ).sort({ [action]: -1 })
        : Promise.resolve([]);

    const folderPromise =
      type === 'all' || type === 'folder'
        ? Folder.find({
            name: { $regex: name, $options: 'i' },
            $or: [{ owner: uid }, { shareWith: uid }],
          }).sort({ [action]: -1 })
        : Promise.resolve([]);

    const promises = [filePromise, folderPromise];

    const [files, folders] = await Promise.all(promises);

    const data = {
      files,
      folders,
    };

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
