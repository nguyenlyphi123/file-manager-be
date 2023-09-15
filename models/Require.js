const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const RequireSchema = new Schema({
  title: {
    type: String,
    default: null,
    required: true,
  },
  author: {
    type: Schema.Types.ObjectId,
    ref: 'account',
  },
  to: [
    {
      info: {
        type: Schema.Types.ObjectId,
        ref: 'account',
      },
      seen: {
        type: Boolean,
        default: false,
      },
      sent: {
        type: Boolean,
        default: false,
      },
      status: {
        type: String,
        enum: ['waiting', 'processing', 'done', 'cancel'],
        default: 'waiting',
      },
    },
  ],
  folder: {
    type: Schema.Types.ObjectId,
    ref: 'folder',
    required: true,
  },
  file_type: {
    type: String,
    enum: [
      'doc',
      'docx',
      'zip',
      'exe',
      'jpg',
      'png',
      'ppt',
      'pdf',
      'svg',
      'txt',
      'xlsx',
      'mp3',
      'mp4',
    ],
    default: 'doc',
    required: true,
  },
  max_size: {
    type: Number,
    default: 10,
  },
  message: {
    type: String,
    default: null,
  },
  note: {
    type: String,
    default: null,
  },
  status: {
    type: String,
    enum: ['waiting', 'processing', 'done', 'cancel'],
    default: 'waiting',
  },
  startDate: {
    type: Date,
    default: Date.now(),
  },
  endDate: {
    type: Date,
    default: Date.now(),
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

RequireSchema.methods.updateIsSent = async function (accountId) {
  const toIndex = this.to.findIndex((toItem) => toItem.info.equals(accountId));

  if (toIndex !== -1) {
    this.to[toIndex].sent = true;
    await this.save();
  }
};

RequireSchema.methods.removeSent = async function (accountId) {
  const toIndex = this.to.findIndex((toItem) => toItem.info.equals(accountId));

  const isSent = this.to[toIndex].sent;
  if (isSent) {
    this.to[toIndex].sent = false;
    await this.save();
  }
};

RequireSchema.methods.updateStatus = async function ({
  accountId,
  memStatus,
  reqStatus,
}) {
  if (accountId === this.author.toString()) {
    this.status = reqStatus;
    await this.save({ new: true });
    return;
  }

  const toIndex = this.to.findIndex((toItem) => toItem.info.equals(accountId));

  if (toIndex !== -1) {
    if (reqStatus) this.status = reqStatus;

    if (memStatus) this.to[toIndex].status = memStatus;
    await this.save({ new: true });
  }
};

module.exports = mongoose.model('requirement', RequireSchema);
