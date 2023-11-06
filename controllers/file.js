const File = require('../models/File');

const { fileResponseEx } = require('../types/file');

const getFileWithQuery = async (q, st, sk, l) => {
  const folders = await File.aggregate([
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
        from: 'folders',
        localField: 'parent_folder',
        foreignField: '_id',
        as: 'parent_folder',
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
        path: '$parent_folder',
        preserveNullAndEmptyArrays: true,
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
      $project: { ...fileResponseEx },
    },
  ]).allowDiskUse(true);

  return folders;
};

module.exports = {
  getFileWithQuery,
};
