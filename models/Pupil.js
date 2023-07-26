const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PupilsSchema = new Schema({
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
  specialization: [
    {
      type: Schema.Types.ObjectId,
      ref: 'specialization',
    },
  ],
  class: {
    type: Schema.Types.ObjectId,
    ref: 'class',
  },

  createAt: {
    type: Date,
    default: Date.now(),
  },
  modifiedAt: {
    type: Date,
    default: Date.now(),
  },
});

module.exports = mongoose.model('pupils', PupilsSchema);
