const Folder = require('../models/Folder');

const { folderResponseEx } = require('../types/folder');

const getFolderWithQuery = async (q) => {
  const folders = await Folder.aggregate([
    {
      $match: {
        ...q,
      },
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

module.exports = {
  getFolderWithQuery,
};
