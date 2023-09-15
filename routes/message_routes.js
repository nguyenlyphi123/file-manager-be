const express = require('express');
const router = express.Router();

const { authorizeUser } = require('../middlewares/authorization');
const Message = require('../models/Message');
const Chat = require('../models/Chat');

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

  const limit = parseInt(req.query.limit) || 20;
  const page = parseInt(req.query.page) || 1;
  const offset = (page - 1) * limit;

  try {
    const messages = await Message.find({ chat: chatId })
      .sort({ _id: -1 })
      .skip(offset)
      .limit(limit)
      .populate({
        path: 'sender',
        select: '-password',
        populate: {
          path: 'info',
        },
      });

    if (!messages || messages.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const messagesToUpdate = messages
      .filter((message) => !message.seen && message.sender._id !== userId)
      .map((message) => message._id);

    if (messagesToUpdate.length > 0) {
      await Message.updateMany(
        { _id: { $in: messagesToUpdate } },
        { $set: { seen: true } },
      );
    }

    return res.json({ success: true, data: messages.reverse() });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

module.exports = router;
