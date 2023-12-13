const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const InformationSchema = new Schema({
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
    default: null,
  },
  specialization: [
    {
      type: Schema.Types.ObjectId,
      ref: 'specialization',
    },
  ],
  class: [
    {
      type: Schema.Types.ObjectId,
      ref: 'class',
    },
  ],
  mentor: {
    type: Schema.Types.ObjectId,
    ref: 'account',
    default: null,
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

module.exports = mongoose.model('information', InformationSchema);
