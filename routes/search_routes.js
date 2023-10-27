const express = require('express');
const router = express.Router();

const { authorizeUser } = require('../middlewares/authorization');

const File = require('../models/File');
const Foleder = require('../models/Folder');

// @GET /api/search/:name
// @desc search folder and file by name
// @access Private
router.get('/:name', authorizeUser, async (req, res) => {
  const uid = req.data.id;
  const name = req.params.name;

  try {
    const promises = [
      File.find({
        name: { $regex: name, $options: 'i' },
        $or: [{ owner: uid }, { shareWith: uid }],
      }),
      Foleder.find({
        name: { $regex: name, $options: 'i' },
        $or: [{ owner: uid }, { shareWith: uid }],
      }),
    ];

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
