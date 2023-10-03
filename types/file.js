const { authorPopulateEx, ownerPopulateEx } = require('./account');
const { folderPopulateEx } = require('./folder');

const fileResponseEx = {
  author: authorPopulateEx,
  owner: ownerPopulateEx,
  parent_folder: folderPopulateEx,
  sub_folder: 0,
  files: 0,
  __v: 0,
};

module.exports = {
  fileResponseEx,
};
