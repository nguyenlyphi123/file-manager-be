const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ChatSchema = new Schema({
  name: {
    type: String,
    dafault: null,
  },
  isGroupChat: {
    type: Boolean,
    default: false,
  },
  member: [
    {
      type: Schema.Types.ObjectId,
      ref: 'account',
    },
  ],
  lastMessage: {
    type: Schema.Types.ObjectId,
    ref: 'message',
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

module.exports = mongoose.model('chat', ChatSchema);
