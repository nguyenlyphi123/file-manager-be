const express = require('express');
const multer = require('multer');
const { authorizeUser } = require('../middlewares/authorization');
const iconv = require('iconv-lite');
const JSZip = require('jszip');

const storage = require('../config/googleStorage');

const Folder = require('../models/Folder');
const File = require('../models/File');
const Require = require('../models/Require');
const RequireOrder = require('../models/RequireOrder');
const { incFolderSize } = require('../helpers/folder.helper');
const { isAuthor } = require('../helpers/AuthHelper');

const router = express.Router();

const bucket = storage.bucket(process.env.GCLOUD_BUCKET_NAME);

const upload = multer();

// @route POST api/gc/upload
// @desc Upload file to Google Cloud Storage
// @access Private
router.post(
  '/upload',
  authorizeUser,
  upload.single('file'),
  async (req, res) => {
    try {
      const file = req.file;
      const parent_folder = req.body.folderId;
      const userId = req.user.id;

      if (!file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded',
        });
      }

      const lastDotIndex = file.originalname.lastIndexOf('.');
      const fileName = file.originalname.substring(0, lastDotIndex);
      const type = file.originalname.substring(lastDotIndex + 1);

      const originalName = Buffer.from(fileName, 'binary');
      const utf8Originalname = iconv.decode(originalName, 'utf8');

      let gcFileName = `${utf8Originalname}_${userId}_${parent_folder}`;
      const regexPattern = new RegExp(`^${fileName}( \\(\\d+\\))?`);

      const sentRequire = await Require.findOne({
        folder: parent_folder,
        'to.info': userId,
        'to.sent': true,
      });

      if (sentRequire) {
        return res.status(400).json({
          success: false,
          message: 'You have already sent this folder',
        });
      }

      const existsFile = await File.find({
        name: {
          $regex: regexPattern,
          $options: 'i',
        },
        author: userId,
        parent_folder,
      });

      const lastIndex = await countExistsFile(existsFile);

      if (existsFile && existsFile.length > 0) {
        const newIndex = lastIndex + 1;
        file.originalname = `${utf8Originalname}_${userId}_${parent_folder} (${newIndex})`;
        gcFileName = `${utf8Originalname}_${userId}_${parent_folder} (${newIndex})`;
      }

      const uploadProcess = bucket.file(`files/${gcFileName}`);

      const stream = uploadProcess.createWriteStream({
        metadata: {
          contentType: file.mimetype,
        },
      });

      stream.on('error', (err) => {
        console.log(err);
        return res
          .status(400)
          .json({ success: false, message: 'Upload file failed' });
      });

      stream.on('finish', async () => {
        const url = await uploadProcess.publicUrl();
        const metadata = await uploadProcess.getMetadata();

        const fileData = {
          name: utf8Originalname,
          type: type,
          size: metadata[0].size,
          author: userId,
          owner: userId,
        };

        if (existsFile && existsFile.length > 0) {
          fileData.name = `${utf8Originalname} (${lastIndex + 1})`;
        }

        if (parent_folder) {
          fileData.parent_folder = parent_folder;
          const folder = await Folder.findById(parent_folder);
          if (folder && folder.owner) {
            fileData.owner = folder.owner;
          }
        }

        const file = new File(fileData);
        const uploadedFile = await file.save();

        await uploadedFile.populate('parent_folder', {
          isRequireFolder: 1,
          owner: 1,
        });

        if (uploadedFile.parent_folder) {
          const updateFolderPromise = Folder.updateOne(
            {
              _id: uploadedFile.parent_folder._id,
            },
            {
              $push: { files: uploadedFile._id },
            },
          );

          const incFolderSizePromise = incFolderSize(
            uploadedFile.parent_folder._id,
            uploadedFile.size,
          );

          await Promise.all([updateFolderPromise, incFolderSizePromise]);
        }

        if (
          uploadedFile.parent_folder.isRequireFolder &&
          !isAuthor(userId, uploadedFile.parent_folder.owner)
        ) {
          const require = await Require.findOne({
            folder: uploadedFile.parent_folder._id,
          }).exec();

          const memberStatus = require.to.find(
            (item) => item.info.toString() === userId.toString(),
          ).status;

          await RequireOrder.updateOne(
            { uid: userId },
            {
              $push: { done: require._id },
              $pull: { [memberStatus]: require._id },
            },
          );

          if (require) {
            await Promise.all([
              require.updateStatus({
                accountId: userId,
                memStatus: process.env.REQ_STATUS_DONE,
                reqStatus: process.env.REQ_STATUS_PROCESSING,
              }),
              require.updateIsSent(userId),
            ]);
          }
        }

        return res.json({
          success: true,
          message: 'File has been uploaded successfully',
          data: { url },
        });
      });

      stream.end(file.buffer);
    } catch (error) {
      console.log(error);
      return res
        .status(500)
        .json({ success: false, message: 'Internal Server Error' });
    }
  },
);

const countExistsFile = async (existsFile) => {
  return existsFile.reduce((max, file) => {
    const match = file.name.match(/\((\d+)\)/);
    if (match) {
      const number = parseInt(match[1], 10);
      if (!isNaN(number) && number > max) {
        return number;
      }
    }
    return max;
  }, 0);
};

// @router POST api/gc/download
// @desc Download file from Google Cloud Storage
// @access Private
router.post('/download', authorizeUser, async (req, res) => {
  const userId = req.user.id;
  const fileData = req.body.data;
  const email = req.user.email;

  try {
    const fileExists = await File.findOne({ name: fileData.name });

    if (
      fileExists.author.toString() !== userId &&
      (!fileExists.sharedTo.includes(email) ||
        !fileExists.permission.includes(process.env.PERMISSION_DOWNLOAD))
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Permission denied! You need to contact your manager to download this file',
      });
    }

    const fileName = `${fileData.name}_${userId}`;
    const [file] = await bucket.file(`files/${fileName}`).download();

    const metadata = await bucket.file(`files/${fileName}`).getMetadata();

    const contentType = metadata[0].contentType;

    const buffer = Buffer.from(file);

    res.set('Content-Type', contentType); // Set the appropriate content type for the file
    res.set('Content-Disposition', `attachment; filename="myfile.some"`);
    res.set('Content-Length', buffer.length);
    res.send(buffer);
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route GET api/gc/folder/download
// @desc Download folder
// @access Private
router.post('/folder/download', authorizeUser, async (req, res) => {
  const folderId = req.body.id;
  const userId = req.user.id;
  const email = req.user.email;

  try {
    const folder = await Folder.findById(folderId);

    if (
      folder.author.toString() !== userId &&
      (!folder.sharedTo.includes(email) ||
        !folder.permission.includes(process.env.PERMISSION_DOWNLOAD))
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Permission denied! You need to contact your manager to download this folder',
      });
    }

    const zip = new JSZip();

    const folders = await getAllFilesInSubFolders(folderId);

    await zipFolderAndFiles(zip, folders);

    const zipData = await zip.generateAsync({ type: 'nodebuffer' });

    res.set('Content-Type', 'application/zip');
    res.set('Content-Disposition', `attachment; filename="archive.zip"`);
    res.set('Content-Length', zipData.length);
    res.send(zipData);
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: 'Something went wrong' });
  }
});

async function zipFolderAndFiles(zip, folderData, currentPath = '') {
  const folderName = folderData.folder;
  const folderPath = currentPath ? `${currentPath}/${folderName}` : folderName;

  const folder = zip.folder(folderPath);

  if (folderData.files && folderData.files.length > 0) {
    for (const file of folderData.files) {
      try {
        const fileName = `${file.name}_${file.author}`;
        const fileZipName = `${file.name}.${file.type}`;

        const [fileData] = await bucket.file(fileName).download();
        const buffer = Buffer.from(fileData);

        folder.file(fileZipName, buffer);
      } catch (error) {
        console.log(error);
        throw new Error(`File not found: ${file.name}`);
      }
    }
  }

  if (folderData.sub_folders && folderData.sub_folders.length > 0) {
    for (const subFolderData of folderData.sub_folders) {
      const folderPath = currentPath
        ? `${currentPath}/${folderName}`
        : folderName;
      await zipFolderAndFiles(zip, subFolderData, folderPath);
    }
  }
}

async function getAllFilesInSubFolders(folderId) {
  const folder = await Folder.findById(folderId).populate('files sub_folder');

  const folderData = {
    folder: folder.name,
    files: folder.files.map((file) => file),
  };

  if (folder.sub_folder && folder.sub_folder.length > 0) {
    const subFolders = [];
    for (const subFolder of folder.sub_folder) {
      const subFolderData = await getAllFilesInSubFolders(subFolder._id);
      subFolders.push(subFolderData);
    }
    folderData.sub_folders = subFolders;
  }

  return folderData;
}

// @route POST api/gc/upload/image
// @desc Upload image to Google Cloud Storage
// @access Private
router.post(
  '/upload/image',
  upload.single('image'),
  authorizeUser,
  async (req, res) => {
    const image = req.file;
    const uid = req.user.id;

    try {
      const splitedFileName = image?.originalname.split('.');
      const fileName = `${splitedFileName[0]}_${uid}.${splitedFileName[1]}`;

      const uploadProcess = bucket.file(`images/${fileName}`);

      const stream = uploadProcess.createWriteStream({
        metadata: {
          contentType: image?.mimetype,
        },
      });

      stream.on('error', (err) => {
        console.log(err);
        return res
          .status(400)
          .json({ success: false, message: 'Upload image failed' });
      });

      stream.on('finish', async () => {
        uploadProcess.makePublic();
        const url = await uploadProcess.publicUrl();

        res.json({
          success: true,
          message: 'Upload image successfully',
          data: { url },
        });
      });

      stream.end(image.buffer);
    } catch (error) {
      console.log(error);
      return res
        .status(500)
        .json({ success: false, message: 'Internal Server Error' });
    }
  },
);

module.exports = router;
