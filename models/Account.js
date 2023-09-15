const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AccountSchema = new Schema({
  username: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  permission: {
    type: String,
    enum: ['ADMIN', 'MANAGER', 'LECTURERS', 'PUPIL'],
  },
  info: {
    type: Schema.Types.ObjectId,
    ref: 'information',
  },
  createAt: {
    type: Date,
    default: Date.now(),
  },
  modifiedAt: {
    type: Date,
    default: Date.now(),
  },
  lastSigned: {
    type: Date,
    default: Date.now(),
  },
});

module.exports = mongoose.model('account', AccountSchema);
