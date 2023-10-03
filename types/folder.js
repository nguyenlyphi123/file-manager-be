const { authorPopulateEx, ownerPopulateEx } = require('./account');

const folderPopulateEx = {
  __v: 0,
  permission: 0,
  sharedTo: 0,
  createAt: 0,
  modifiedAt: 0,
  lastOpened: 0,
  sub_folder: 0,
  files: 0,
};

const folderResponseEx = {
  author: authorPopulateEx,
  owner: ownerPopulateEx,
  parent_folder: folderPopulateEx,
  sub_folder: 0,
  files: 0,
  __v: 0,
};

module.exports = {
  folderPopulateEx,
  folderResponseEx,
};
