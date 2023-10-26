const Account = require('../models/Account');
const Information = require('../models/Information');
const { userPopulateEx, accountInfoPopulateEx } = require('../types/account');

const getAuth = async (q) => {
  const account = await Account.aggregate([
    { $match: q },
    {
      $lookup: {
        from: 'information',
        localField: 'info',
        foreignField: '_id',
        as: 'info',
      },
    },
    {
      $unwind: {
        path: '$info',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: userPopulateEx,
    },
  ]);

  return account;
};

const getInfomation = async (q) => {
  const information = await Information.aggregate([
    {
      $match: q,
    },
    {
      $lookup: {
        from: 'account',
        localField: 'account_id',
        foreignField: '_id',
        as: 'account',
      },
    },
    {
      $unwind: {
        path: '$account',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: accountInfoPopulateEx,
    },
  ]);

  return information;
};

module.exports = {
  getAuth,
  getInfomation,
};
