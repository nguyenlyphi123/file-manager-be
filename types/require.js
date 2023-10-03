const { authorPopulateEx } = require('./account');
const { folderPopulateEx } = require('./folder');

const requireResponseEx = {
  folder: folderPopulateEx,
  author: authorPopulateEx,
  __v: 0,
};

module.exports = {
  requireResponseEx,
};
