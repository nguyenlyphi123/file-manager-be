const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const SpecializationSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  major: {
    type: Schema.Types.ObjectId,
    ref: 'major',
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

module.exports = mongoose.model('specialization', SpecializationSchema);
