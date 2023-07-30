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

    await Chat.findOneAndUpdate({ _id: chat }, { lastMessage: message._id });

    return res.json({ success: true, data: message });
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

  try {
    const messages = await Message.find({ chat: chatId }).populate('sender');

    if (!messages)
      return res
        .status(404)
        .json({ success: false, message: 'No messages found' });

    return res.json({ success: true, data: messages });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

module.exports = router;
