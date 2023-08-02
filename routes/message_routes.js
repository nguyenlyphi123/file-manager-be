const express = require('express');
const router = express.Router();

const { authorizeUser } = require('../middlewares/authorization');
const Message = require('../models/Message');
const Chat = require('../models/Chat');
const Manager = require('../models/Manager');
const Lecturers = require('../models/Lecturers');
const Pupil = require('../models/Pupil');
const Account = require('../models/Account');

// @route POST api/message
// @desc Create a new message by chatId
// @access Private
router.post('/', authorizeUser, async (req, res) => {
  const userId = req.data.id;
  const { content, chat } = req.body;

  if (!content || !chat)
    return res.status(400).json({
      success: false,
      message: 'Oops! It looks like some data of your request is missing',
    });

  try {
    const message = new Message({
      sender: userId,
      content,
      chat,
    });

    await message.save();

    await Chat.findOneAndUpdate(
      { _id: chat },
      { $set: { lastOpened: Date.now() } },
    );

    await Chat.findOneAndUpdate({ _id: chat }, { lastMessage: message._id });

    return res.json({ success: true, data: message });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route GET api/message/unseen
// @desc Get all unseen messages by userId
// @access Private
router.get('/unseen', authorizeUser, async (req, res) => {
  const userId = req.data.id;

  try {
    const chats = await Chat.find({
      member: { $elemMatch: { $eq: userId } },
    });

    const chatIds = chats.map((chat) => chat._id);

    const messages = await Message.find({
      chat: { $in: chatIds },
      seen: false,
      sender: { $ne: userId },
    });

    const data = {
      hasUnseenMessages: messages.length > 0,
      quantity: messages.length > 0 ? messages.length : 0,
    };

    return res.json({ success: true, data: data });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route GET api/message/:chatId
// @desc Get all messages by chatId
// @access Private
router.get('/:chatId', authorizeUser, async (req, res) => {
  const chatId = req.params.chatId;
  const userId = req.data.id;

  try {
    const messages = await Message.find({ chat: chatId }).populate({
      path: 'sender',
      select: '-password',
    });

    if (!messages || messages.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const uniqueSenders = messages.reduce((acc, message) => {
      const { _id, permission } = message.sender;
      const key = `${_id}-${permission}`;

      if (!acc.has(key)) {
        acc.set(key, { _id, permission });
      }

      return acc;
    }, new Map());

    const sendersInfo = await getSendersInfo(
      Array.from(uniqueSenders.values()),
    );

    const updatedMessages = messages.map((message) => {
      const senderInfo = sendersInfo.find((info) =>
        info._id.equals(message.sender._id),
      );
      const sender = senderInfo ? { ...senderInfo } : message.sender;

      return {
        _id: message._id,
        sender,
        content: message.content,
        chat: message.chat,
        seen: message.seen,
        createAt: message.createAt,
      };
    });

    const messagesToUpdate = updatedMessages
      .filter((message) => !message.seen && message.sender._id !== userId)
      .map((message) => message._id);

    if (messagesToUpdate.length > 0) {
      await Message.updateMany(
        { _id: { $in: messagesToUpdate } },
        { $set: { seen: true } },
      );
    }

    return res.json({ success: true, data: updatedMessages });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

const getSendersInfo = async (senders) => {
  const sendersInfo = senders.map(async (sender) => {
    switch (sender.permission) {
      case process.env.PERMISSION_MANAGER:
        const managerInfo = await Manager.findOne({ account_id: sender._id });

        return {
          _id: sender._id,
          permission: sender.permission,
          name: managerInfo.name,
          email: managerInfo.email,
          lastSigned: sender.lastSigned,
        };

      case process.env.PERMISSION_LECTURERS:
        const lecturersInfo = await Lecturers.findOne({
          account_id: sender._id,
        });

        return {
          _id: sender._id,
          permission: sender.permission,
          name: lecturersInfo.name,
          email: lecturersInfo.email,
          lastSigned: sender.lastSigned,
        };

      case process.env.PERMISSION_PUPIL:
        const pupilInfo = await Pupil.findOne({ account_id: sender._id });

        return {
          _id: sender._id,
          permission: sender.permission,
          name: pupilInfo.name,
          email: pupilInfo.email,
          lastSigned: sender.lastSigned,
        };

      default:
        return;
    }
  });

  return Promise.all(sendersInfo);
};

module.exports = router;
