const Require = require('../models/Require');

const requireResponseEx = require('../types/require').requireResponseEx;

const getRequireWithQuery = async (q) => {
  const requires = await Require.aggregate([
    {
      $match: q,
    },
    {
      $unwind: {
        path: '$to',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: 'folders',
        localField: 'folder',
        foreignField: '_id',
        as: 'folder',
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
        localField: 'to.info',
        foreignField: '_id',
        as: 'infoDetails',
      },
    },
    {
      $unwind: {
        path: '$infoDetails',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $unwind: {
        path: '$folder',
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
        localField: 'infoDetails.info',
        foreignField: '_id',
        as: 'additionalInfoDetails',
      },
    },
    {
      $unwind: {
        path: '$author.info',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $unwind: {
        path: '$additionalInfoDetails',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $group: {
        _id: '$_id',
        title: {
          $first: '$title',
        },
        author: {
          $first: '$author',
        },
        folder: {
          '$first': '$folder',
        },
        file_type: {
          $first: '$file_type',
        },
        max_size: {
          $first: '$max_size',
        },
        message: {
          $first: '$message',
        },
        note: {
          $first: '$note',
        },
        status: {
          $first: '$status',
        },
        startDate: {
          $first: '$startDate',
        },
        endDate: {
          $first: '$endDate',
        },
        createAt: {
          $first: '$createAt',
        },
        modifiedAt: {
          $first: '$modifiedAt',
        },
        to: {
          $push: {
            info: {
              _id: '$infoDetails._id',
              name: '$additionalInfoDetails.name',
              email: '$additionalInfoDetails.email',
              image: '$additionalInfoDetails.image',
            },
            seen: '$to.seen',
            sent: '$to.sent',
            status: '$to.status',
          },
        },
      },
    },
    { $project: { ...requireResponseEx } },
  ]).allowDiskUse(true);

  return requires;
};

module.exports = {
  getRequireWithQuery,
};
