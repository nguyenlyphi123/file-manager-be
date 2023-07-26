const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ClassSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  specialization: {
    type: Schema.Types.ObjectId,
    ref: 'specialization',
    required: true,
  },
  pupil: [
    {
      type: Schema.Types.ObjectId,
      ref: 'pupil',
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

module.exports = mongoose.model('class', ClassSchema);
