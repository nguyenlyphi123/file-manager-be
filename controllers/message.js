const Message = require('../models/Message');

const { messageResponseEx } = require('../types/message');

const getMessagesWithQuery = async (q) => {
  const { queries, skip, limit } = q;

  const pipeline = [
    {
      $match: {
        ...queries,
      },
    },
    {
      $sort: {
        _id: -1,
      },
    },
  ];

  if (skip !== undefined) {
    pipeline.push({
      $skip: skip,
    });
  }

  if (limit !== undefined) {
    pipeline.push({
      $limit: limit,
    });
  }

  pipeline.push(
    {
      $lookup: {
        from: 'accounts',
        localField: 'sender',
        foreignField: '_id',
        as: 'sender',
      },
    },
    {
      $unwind: {
        path: '$sender',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: 'information',
        localField: 'sender.info',
        foreignField: '_id',
        as: 'sender.info',
      },
    },
    {
      $unwind: {
        path: '$sender.info',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: { ...messageResponseEx },
    },
  );

  const messages = await Message.aggregate(pipeline);

  return messages;
};

module.exports = {
  getMessagesWithQuery,
};
