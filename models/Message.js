const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MessageSchema = new Schema({
  sender: {
    type: Schema.Types.ObjectId,
    ref: 'account',
  },
  content: {
    type: String,
    default: null,
  },
  chat: {
    type: Schema.Types.ObjectId,
    ref: 'chat',
  },
  seen: {
    type: Boolean,
    default: false,
  },
  createAt: {
    type: Date,
    default: Date.now(),
  },
});

module.exports = mongoose.model('message', MessageSchema);
