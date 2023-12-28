const { Types } = require('mongoose');

const Folder = require('../models/Folder');
const { transferSelection } = require('./hepler');

const findAllFiles = async (folderId, fileSelector) => {
  const pipeline = [
    {
      $match: {
        _id: new Types.ObjectId(folderId),
      },
    },
    {
      $graphLookup: {
        from: 'folders',
        startWith: '$_id',
        connectFromField: '_id',
        connectToField: 'parent_folder',
        as: 'subFolders',
      },
    },
    {
      $unwind: {
        path: '$subFolders',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: 'files',
        localField: 'subFolders.files',
        foreignField: '_id',
        as: 'subFolderFiles',
      },
    },
    {
      $project: {
        subFolder: {
          _id: '$subFolders._id',
          name: '$subFolders.name',
        },
        subFolderFiles: fileSelector
          ? transferSelection(fileSelector)
          : {
              _id: 1,
              name: 1,
            },
      },
    },
    {
      $unwind: {
        path: '$subFolderFiles',
        preserveNullAndEmptyArrays: false,
      },
    },
    {
      $replaceRoot: {
        newRoot: {
          $ifNull: ['$subFolderFiles', '$subFolder'],
        },
      },
    },
  ];

  const result = await Folder.aggregate(pipeline);

  return result;
};

const findAllFileWithFolderIds = async (folderIds) => {
  const pipeline = [
    {
      $match: {
        _id: {
          $in: folderIds.map((f) => new Types.ObjectId(f)),
        },
      },
    },
    {
      $graphLookup: {
        from: 'folders',
        startWith: '$_id',
        connectFromField: '_id',
        connectToField: 'parent_folder',
        as: 'subFolders',
      },
    },
    {
      $unwind: {
        path: '$subFolders',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: 'files',
        localField: 'subFolders.files',
        foreignField: '_id',
        as: 'subFolderFiles',
      },
    },
    {
      $project: {
        subFolder: {
          _id: '$subFolders._id',
          name: '$subFolders.name',
        },
        subFolderFiles: {
          _id: 1,
          name: 1,
        },
      },
    },
    {
      $unwind: {
        path: '$subFolderFiles',
        preserveNullAndEmptyArrays: false,
      },
    },
    {
      $replaceRoot: {
        newRoot: {
          $ifNull: ['$subFolderFiles', '$subFolder'],
        },
      },
    },
  ];

  const result = await Folder.aggregate(pipeline);

  return result;
};

module.exports = {
  findAllFiles,
  findAllFileWithFolderIds,
};
