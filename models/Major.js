const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MajorSchema = new Schema({
  name: {
    type: String,
    required: true,
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

module.exports = mongoose.model('major', MajorSchema);
