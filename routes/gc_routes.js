const express = require('express');
const multer = require('multer');
const { Storage } = require('@google-cloud/storage');
const path = require('path');
const { authorizeUser } = require('../middlewares/authorization');
const iconv = require('iconv-lite');
const JSZip = require('jszip');

const Folder = require('../models/Folder');
const File = require('../models/File');

const router = express.Router();

const storage = new Storage({
  projectId: process.env.GCLOUD_PROJECT_ID,
  keyFilename: path.join(__dirname, '../serviceAccountKey.json'),
});

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
    const file = req.file;
    const parent_folder = req.body.folderId;
    const userId = req.data.id;

    const lastDotIndex = file.originalname.lastIndexOf('.');

    const fileName = file.originalname.substring(0, lastDotIndex);
    const type = file.originalname.substring(lastDotIndex + 1);

    const originalName = Buffer.from(fileName, 'binary');
    const utf8Originalname = iconv.decode(originalName, 'utf8');

    file.originalname = `${utf8Originalname}_${userId}`;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    const process = bucket.file(file.originalname);

    const stream = process.createWriteStream({
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
      try {
        const url = await process.publicUrl();

        const metadata = await process.getMetadata();

        const fileData = {
          name: utf8Originalname,
          type: type,
          size: metadata[0].size,
          author: userId,
        };

        if (parent_folder) {
          fileData.parent_folder = parent_folder;
        }

        const file = new File(fileData);

        const uploadedFile = await file.save();
        if (uploadedFile.parent_folder) {
          await Folder.updateOne(
            {
              _id: uploadedFile.parent_folder,
              author: userId,
            },
            { $push: { files: uploadedFile._id } },
          );
        }

        return res.json({
          success: true,
          message: 'File has been uploaded successfully',
          data: { url },
        });
      } catch (error) {
        console.log(error);
        return res
          .status(500)
          .json({ success: false, message: 'Internal Server Error' });
      }
    });

    stream.end(file.buffer);
  },
);

// @router POST api/gc/download
// @desc Download file from Google Cloud Storage
// @access Private
router.post('/download', authorizeUser, async (req, res) => {
  const userId = req.data.id;
  const fileData = req.body.data;
  const email = req.data.email;

  try {
    const fileExists = await File.findOne({ name: fileData.name });

    if (
      fileExists.author !== userId &&
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
    const [file] = await bucket.file(fileName).download();

    const metadata = await bucket.file(fileName).getMetadata();

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
  const userId = req.data.id;
  const email = req.data.email;

  try {
    const folder = await Folder.findById(folderId);

    if (
      folder.author !== userId &&
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

module.exports = router;
