const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const RequireOrderSchema = new Schema({
  uid: {
    type: Schema.Types.ObjectId,
    ref: 'account',
  },
  waiting: [
    {
      type: Schema.Types.ObjectId,
      ref: 'requirement',
    },
  ],
  processing: [
    {
      type: Schema.Types.ObjectId,
      ref: 'requirement',
    },
  ],
  done: [
    {
      type: Schema.Types.ObjectId,
      ref: 'requirement',
    },
  ],
  cancel: [
    {
      type: Schema.Types.ObjectId,
      ref: 'requirement',
    },
  ],
});

module.exports = mongoose.model('require_order', RequireOrderSchema);
