const express = require('express');
const router = express.Router();

const { authorizeUser } = require('../middlewares/authorization');
const Chat = require('../models/Chat');
const Manager = require('../models/Manager');
const Lecturers = require('../models/Lecturers');
const Pupil = require('../models/Pupil');

// @route POST api/chat
// @desc Create a new chat
// @access Private
router.post('/', async (req, res) => {
  const { name, isGroupChat, member } = req.body;

  if (!member)
    return res.status(400).json({
      success: false,
      message: 'Oops! It looks like some data of your request is missing',
    });

  try {
    const chat = new Chat({
      name: name ? name : null,
      isGroupChat,
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

// @route GET api/chat
// @desc Get all chats by member
// @access Private
router.get('/', authorizeUser, async (req, res) => {
  const userId = req.data.id;

  try {
    const chats = await Chat.find({
      member: { $elemMatch: { $eq: userId } },
    })
      .populate('member')
      .populate('lastMessage');

    if (!chats)
      return res
        .status(404)
        .json({ success: false, message: 'No chats found' });

    const updatedChats = await getMemberInfo(chats, userId);

    return res.json({ success: true, data: updatedChats });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

const getMemberInfo = async (chats) => {
  const updatedChats = await Promise.all(
    chats.map(async (chat) => {
      const updatedMembers = await Promise.all(
        chat.member.map(async (member) => {
          switch (member.permission) {
            case process.env.PERMISSION_MANAGER:
              const managerInfo = await Manager.findOne({
                account_id: member._id,
              });
              return {
                _id: member._id,
                permission: member.permission,
                name: managerInfo.name,
                email: managerInfo.email,
              };

            case process.env.PERMISSION_LECTURERS:
              const lecturersInfo = await Lecturers.findOne({
                account_id: member._id,
              });
              return {
                _id: member._id,
                permission: member.permission,
                name: lecturersInfo.name,
                email: lecturersInfo.email,
              };

            case process.env.PERMISSION_PUPIL:
              const pupilInfo = await Pupil.findOne({
                account_id: member._id,
              });
              return {
                _id: member._id,
                permission: member.permission,
                name: pupilInfo.name,
                email: pupilInfo.email,
              };

            default:
              return member;
          }
        }),
      );

      return {
        _id: chat._id,
        name: chat.name,
        isGroupChat: chat.isGroupChat,
        member: updatedMembers,
        lastMessage: chat.lastMessage,
        createAt: chat.createAt,
        modifiedAt: chat.modifiedAt,
        lastOpened: chat.lastOpened,
      };
    }),
  );

  return updatedChats;
};

module.exports = router;
