const Account = require('../models/Account');
const { userPopulateEx } = require('../types/account');

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

module.exports = {
  getAuth,
};
