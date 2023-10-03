const { authorPopulateEx } = require('./account');
const { messagePopulateEx } = require('./message');

const chatResponseEx = {
  author: authorPopulateEx,
  member: authorPopulateEx,
  lastMessage: messagePopulateEx,
};

module.exports = {
  chatResponseEx,
};
