const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const FileSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: [
      'doc',
      'docx',
      'zip',
      'exe',
      'jpg',
      'png',
      'ppt',
      'pdf',
      'svg',
      'txt',
      'xlsx',
      'mp3',
      'mp4',
    ],
    default: 'doc',
  },
  size: {
    type: Number,
    default: 0,
  },
  parent_folder: {
    type: Schema.Types.ObjectId,
    ref: 'folder',
    default: null,
  },
  author: {
    type: Schema.Types.ObjectId,
    ref: 'account',
  },
  isStar: {
    type: Boolean,
    default: false,
  },
  isDelete: {
    type: Boolean,
    default: false,
  },
  sharedTo: [
    {
      type: String,
      default: null,
    },
  ],
  permission: [
    {
      type: String,
      enum: ['DOWNLOAD', 'SHARE', 'EDIT'],
      default: ['DOWNLOAD', 'SHARE'],
    },
  ],
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

module.exports = mongoose.model('file', FileSchema);
