const { informationPopulateEx } = require('./information');

const userPopulateEx = {
  username: 0,
  password: 0,
  __v: 0,
  createAt: 0,
  modifiedAt: 0,
  info: {
    ...informationPopulateEx,
  },
};

const authorPopulateEx = {
  ...userPopulateEx,
};

const ownerPopulateEx = {
  ...authorPopulateEx,
};

const accountInfoPopulateEx = {
  account: {
    password: 0,
    createAt: 0,
    modifiedAt: 0,
    lastSigned: 0,
    info: 0,
    __v: 0,
  },
};

module.exports = {
  authorPopulateEx,
  ownerPopulateEx,
  userPopulateEx,
  accountInfoPopulateEx,
};
