const { Types } = require('mongoose');
const Folder = require('../models/Folder');

const { folderResponseEx } = require('../types/folder');

const getFolderWithQuery = async (q, st, sk, l) => {
  const folders = await Folder.aggregate([
    {
      $match: {
        ...q,
      },
    },
    {
      $sort: {
        ...st,
      },
    },
    {
      $skip: sk,
    },
    {
      $limit: l,
    },
    {
      $lookup: {
        from: 'accounts',
        localField: 'author',
        foreignField: '_id',
        as: 'author',
      },
    },
    {
      $lookup: {
        from: 'accounts',
        localField: 'owner',
        foreignField: '_id',
        as: 'owner',
      },
    },
    {
      $unwind: {
        path: '$author',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $unwind: {
        path: '$owner',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: 'information',
        localField: 'author.info',
        foreignField: '_id',
        as: 'author.info',
      },
    },
    {
      $lookup: {
        from: 'information',
        localField: 'owner.info',
        foreignField: '_id',
        as: 'owner.info',
      },
    },
    {
      $unwind: '$author.info',
    },
    {
      $unwind: '$owner.info',
    },
    {
      $project: { ...folderResponseEx },
    },
  ]).allowDiskUse(true);

  return folders;
};

const incFolderSize = async (folderId, size) => {
  try {
    if (size === 0) return;

    const currentFolder = await Folder.findOneAndUpdate(
      { _id: folderId },
      { $inc: { size: size } },
      { new: true },
    );

    if (!currentFolder || !currentFolder.parent_folder) {
      return;
    }

    await incFolderSize(currentFolder.parent_folder, size);
  } catch (error) {
    console.error(
      `Error updating folder size for folder ${folderId}: ${error.message}`,
    );
  }
};

const descFolderSize = async (folderId, size) => {
  try {
    if (size === 0) return;

    const currentFolder = await Folder.findOneAndUpdate(
      { _id: folderId },
      { $inc: { size: -size } },
      { new: true },
    );

    if (!currentFolder || !currentFolder.parent_folder) {
      return;
    }

    await descFolderSize(currentFolder.parent_folder, size);
  } catch (error) {
    console.error(
      `Error updating folder size for folder ${folderId}: ${error.message}`,
    );
  }
};

const genFolderLocation = async (parentId) => {
  if (!parentId) return [];

  const pipeline = [
    {
      $match: {
        _id: new Types.ObjectId(parentId),
      },
    },
    {
      $graphLookup: {
        from: 'folders',
        startWith: '$parent_folder',
        connectFromField: 'parent_folder',
        connectToField: '_id',
        as: 'ancestors',
      },
    },
    {
      $unwind: {
        path: '$ancestors',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $replaceRoot: {
        newRoot: {
          $ifNull: ['$ancestors', '$$ROOT'],
        },
      },
    },
    {
      $project: {
        _id: 1,
        name: 1,
      },
    },
  ];

  const result = await Folder.aggregate(pipeline);

  return result;
};

const findAllSubFolder = async (folderId) => {
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
        as: 'sub_folder',
      },
    },
    {
      $unwind: {
        path: '$sub_folder',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $replaceRoot: {
        newRoot: {
          $ifNull: ['$sub_folder', '$$ROOT'],
        },
      },
    },
    {
      $project: {
        _id: 1,
        name: 1,
      },
    },
  ];

  const result = await Folder.aggregate(pipeline);

  return result;
};

const findAllSubFolderWithFolderIds = async (folderIds) => {
  const pipeline = [
    {
      $match: {
        _id: {
          $in: folderIds.map((folderId) => new Types.ObjectId(folderId)),
        },
      },
    },
    {
      $graphLookup: {
        from: 'folders',
        startWith: '$_id',
        connectFromField: '_id',
        connectToField: 'parent_folder',
        as: 'sub_folder',
      },
    },
    {
      $unwind: {
        path: '$sub_folder',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $replaceRoot: {
        newRoot: {
          $ifNull: ['$sub_folder', '$$ROOT'],
        },
      },
    },
    {
      $project: {
        _id: 1,
        name: 1,
      },
    },
  ];

  const result = await Folder.aggregate(pipeline);

  return result;
};

module.exports = {
  incFolderSize,
  descFolderSize,
  genFolderLocation,
  findAllSubFolder,
  findAllSubFolderWithFolderIds,
  getFolderWithQuery,
};
