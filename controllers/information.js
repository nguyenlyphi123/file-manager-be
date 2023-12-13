const Information = require('../models/Information');
const { informationRes } = require('../types/information');

const getInformationWithQuery = async (q) => {
  const informations = await Information.aggregate([
    {
      $match: {
        ...q,
      },
    },
    {
      $lookup: {
        from: 'accounts',
        localField: 'account_id',
        foreignField: '_id',
        as: 'account_id',
      },
    },

    {
      $lookup: {
        from: 'majors',
        localField: 'major',
        foreignField: '_id',
        as: 'major',
      },
    },
    {
      $lookup: {
        from: 'specializations',
        localField: 'specialization',
        foreignField: '_id',
        as: 'specialization',
      },
    },
    {
      $lookup: {
        from: 'classes',
        localField: 'class',
        foreignField: '_id',
        as: 'class',
      },
    },
    {
      $unwind: {
        path: '$account_id',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $unwind: {
        path: '$major',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: informationRes,
    },
  ]);

  return informations[0];
};

module.exports = {
  getInformationWithQuery,
};
