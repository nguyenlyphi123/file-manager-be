const { authorPopulateEx } = require('./account');

const messagePopulateEx = {
  chat: 0,
  __v: 0,
};

const messageResponseEx = {
  __v: 0,
  chat: 0,
  sender: authorPopulateEx,
};

module.exports = {
  messagePopulateEx,
  messageResponseEx,
};
