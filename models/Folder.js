const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const FolderSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  author: {
    type: Schema.Types.ObjectId,
    ref: 'account',
  },
  owner: {
    type: Schema.Types.ObjectId,
    ref: 'account',
    default: null,
  },
  parent_folder: {
    type: Schema.Types.ObjectId,
    ref: 'folder',
    default: null,
  },
  sub_folder: [
    {
      type: Schema.Types.ObjectId,
      ref: 'folder',
    },
  ],
  files: [
    {
      type: Schema.Types.ObjectId,
      ref: 'file',
    },
  ],
  sharedTo: [
    {
      type: String,
      default: null,
    },
  ],
  permission: [
    {
      type: String,
      enum: ['READ', 'WRITE', 'DOWNLOAD', 'SHARE', 'EDIT'],
      default: ['READ', 'DOWNLOAD', 'SHARE'],
    },
  ],
  size: {
    type: Number,
    default: 0,
  },
  quickAccess: {
    type: Boolean,
    default: false,
  },
  isStar: {
    type: Boolean,
    default: false,
  },
  isDelete: {
    type: Boolean,
    default: false,
  },
  isRequireFolder: {
    type: Boolean,
    default: false,
  },
  createAt: {
    type: Date,
    default: Date.now(),
  },
  modifiedAt: {
    type: Date,
    default: Date.now(),
  },
  lastOpened: {
    type: Date,
    default: Date.now(),
  },
});

module.exports = mongoose.model('folder', FolderSchema);
