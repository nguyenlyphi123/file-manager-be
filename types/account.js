const { informationPopulateEx } = require('./information');

const authorPopulateEx = {
  username: 0,
  password: 0,
  __v: 0,
  createAt: 0,
  modifiedAt: 0,
  info: {
    ...informationPopulateEx,
  },
};

const ownerPopulateEx = {
  ...authorPopulateEx,
};

module.exports = {
  authorPopulateEx,
  ownerPopulateEx,
};
