const Chat = require('../models/Chat');

const { chatResponseEx } = require('../types/chat');

const getChatWithQuery = async (q) => {
  const chats = await Chat.aggregate([
    {
      $match: {
        ...q,
      },
    },
    {
      $sort: {
        modifiedAt: -1,
      },
    },
    {
      $lookup: {
        from: 'accounts',
        localField: 'member',
        foreignField: '_id',
        as: 'member',
      },
    },
    {
      $lookup: {
        from: 'messages',
        localField: 'lastMessage',
        foreignField: '_id',
        as: 'lastMessage',
      },
    },
    {
      $lookup: {
        from: 'accounts',
        localField: 'author',
        foreignField: '_id',
        as: 'author',
      },
    },
    {
      $unwind: {
        path: '$member',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $unwind: {
        path: '$lastMessage',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $unwind: {
        path: '$author',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: 'information',
        localField: 'member.info',
        foreignField: '_id',
        as: 'member.info',
      },
    },
    {
      $lookup: {
        from: 'information',
        localField: 'author.info',
        foreignField: '_id',
        as: 'author.info',
      },
    },
    {
      $unwind: {
        path: '$member.info',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $unwind: {
        path: '$author.info',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $group: {
        _id: '$_id',
        name: { $first: '$name' },
        isGroupChat: { $first: '$isGroupChat' },
        createAt: { $first: '$createAt' },
        modifiedAt: { $first: '$modifiedAt' },
        lastOpened: { $first: '$lastOpened' },
        member: { $push: '$member' },
        lastMessage: { $first: '$lastMessage' },
        author: { $first: '$author' },
      },
    },
    {
      $project: { ...chatResponseEx },
    },
  ]);

  return chats;
};

module.exports = {
  getChatWithQuery,
};
