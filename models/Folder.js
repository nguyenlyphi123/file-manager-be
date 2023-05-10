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
  isStar: {
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
