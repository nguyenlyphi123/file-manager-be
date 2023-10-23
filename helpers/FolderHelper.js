const { Types } = require('mongoose');
const Folder = require('../models/Folder');

const IncFolderSize = async (folderId, size) => {
  const currentFolder = await Folder.findById(folderId);

  currentFolder.size += size;
  await currentFolder.save();

  if (currentFolder.parent_folder) {
    await IncFolderSize(currentFolder.parent_folder, size);
  }

  return;
};

const DescFolderSize = async (folderId, size) => {
  const currentFolder = await Folder.findById(folderId);

  currentFolder.size -= size;

  await currentFolder.save();

  if (currentFolder.parent_folder) {
    await DescFolderSize(currentFolder.parent_folder, size);
  }

  return;
};

const GenFolderLocation = async (parentId) => {
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

module.exports = {
  IncFolderSize,
  DescFolderSize,
  GenFolderLocation,
};
