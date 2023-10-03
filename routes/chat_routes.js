const express = require('express');
const router = express.Router();
const { Types } = require('mongoose');

const { authorizeUser } = require('../middlewares/authorization');
const Chat = require('../models/Chat');
const Message = require('../models/Message');

const { getChatWithQuery } = require('../controllers/chat');

// @route POST api/chat
// @desc Create a new chat
// @access Private
router.post('/', authorizeUser, async (req, res) => {
  const { name, member } = req.body;
  const userId = req.data.id;

  if (!member)
    return res.status(400).json({
      success: false,
      message: 'Oops! It looks like some data of your request is missing',
    });

  try {
    const chat = new Chat({
      name: name ? name : null,
      isGroupChat: false,
      author: userId,
      member,
      lastMessage: null,
    });

    await chat.save();

    return res.json({ success: true, data: chat });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route POST api/chat/group
// @desc Create a new group chat
// @access Private
router.post('/group', authorizeUser, async (req, res) => {
  const { name, member } = req.body;
  const userId = req.data.id;

  if (!member || !name)
    return res.status(400).json({
      success: false,
      message: 'Oops! It looks like some data of your request is missing',
    });

  try {
    const chat = new Chat({
      name,
      isGroupChat: true,
      member,
      lastMessage: null,
      author: userId,
    });

    await chat.save();

    return res.json({ success: true, data: chat });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route POST api/chat/delete
// @desc Delete a chat by chatId
// @access Private
router.post('/delete', authorizeUser, async (req, res) => {
  const { chatId } = req.body;

  try {
    await Chat.findOneAndDelete({ _id: chatId });
    await Message.deleteMany({ chat: chatId });
    return res.json({ success: true, message: 'Delete chat successfully' });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route POST api/chat/group/leave
// @desc Leave a chat by chatId
// @access Private
router.post('/group/leave', authorizeUser, async (req, res) => {
  const userId = req.data.id;
  const { chatId } = req.body;

  try {
    const chat = await Chat.findOneAndUpdate(
      { _id: chatId },
      { $pull: { member: userId } },
    );

    if (!chat)
      return res
        .status(404)
        .json({ success: false, message: 'Chat not found' });

    return res.json({
      success: true,
      message: 'Leave group chat successfully',
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route POST api/chat/group/add
// @desc Add a member to a group chat
// @access Private
router.post('/group/add', authorizeUser, async (req, res) => {
  const { chatId, memberId } = req.body;

  try {
    const memberExist = await Chat.findOne({
      _id: chatId,
      member: { $elemMatch: { $eq: memberId } },
    });

    if (memberExist)
      return res
        .status(400)
        .json({ success: false, message: 'Member already exist' });

    const chat = await Chat.findOneAndUpdate(
      { _id: chatId },
      { $push: { member: memberId } },
    );

    if (!chat)
      return res
        .status(404)
        .json({ success: false, message: 'Chat not found' });

    return res.json({
      success: true,
      message: 'Add member to group chat successfully',
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route POST api/chat/group/remove
// @desc Remove a member from a group chat
// @access Private
router.post('/group/remove', authorizeUser, async (req, res) => {
  const { chatId, memberId } = req.body;
  const userId = req.data.id;

  try {
    const chat = await Chat.findOneAndUpdate(
      { _id: chatId, author: { $eq: userId } },
      { $pull: { member: memberId } },
    );

    if (!chat)
      return res.status(400).json({
        success: false,
        message: 'Chat not found or you have not permission to do that',
      });

    return res.json({
      success: true,
      message: 'Remove member from group chat successfully',
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route POST api/chat/group/delete
// @desc Delete a group chat
// @access Private
router.post('/group/delete', authorizeUser, async (req, res) => {
  const { chatId } = req.body;
  const userId = req.data.id;

  try {
    const chat = await Chat.findOneAndDelete({
      _id: chatId,
      author: { $eq: userId },
    });

    if (!chat)
      return res.status(400).json({
        success: false,
        message: 'Chat not found or you have not permission to do that',
      });

    await Message.deleteMany({ chat: chatId });

    return res.json({
      success: true,
      message: 'Delete group chat successfully',
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

// @route GET api/chat
// @desc Get all chats by member
// @access Private
router.get('/', authorizeUser, async (req, res) => {
  const userId = req.data.id;

  try {
    const queries = {
      member: { $elemMatch: { $eq: new Types.ObjectId(userId) } },
    };

    const chats = await getChatWithQuery(queries);

    return res.json({ success: true, data: chats });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

module.exports = router;
