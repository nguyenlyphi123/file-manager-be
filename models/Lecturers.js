const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const LecturersSchema = new Schema({
  account_id: {
    type: Schema.Types.ObjectId,
    ref: 'account',
  },
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  image: {
    type: String,
    default: null,
  },
  major: {
    type: Schema.Types.ObjectId,
    ref: 'major',
  },
  specialization: [
    {
      type: Schema.Types.ObjectId,
      ref: 'specialization',
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
});

module.exports = mongoose.model('lecturers', LecturersSchema);
