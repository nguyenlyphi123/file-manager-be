const isDone = (require) => {
  return require.status === process.env.REQ_STATUS_DONE;
};

const getRequireStatusParams = (require, userId, destination) => {
  const isAuthor = require.author.toString() === userId;

  if (isAuthor) {
    return {
      accountId: userId,
      reqStatus: destination,
    };
  } else {
    const countDone = require.to.filter(
      (toItem) => toItem.status === process.env.REQ_STATUS_DONE,
    ).length;

    if (countDone === 0) {
      return {
        accountId: userId,
        memStatus: destination,
        reqStatus: process.env.REQ_STATUS_PROCESSING,
      };
    }

    if (countDone === require.to.length - 1) {
      return {
        accountId: userId,
        memStatus: destination,
        reqStatus: process.env.REQ_STATUS_DONE,
      };
    }

    return {
      accountId: userId,
      memStatus: destination,
    };
  }
};

const isAuthor = (require, userId) => {
  return require.author._id.toString() === userId;
};

const getMemberStatus = (require, userId) => {
  const member = require.to.find((item) => item.info._id.toString() === userId);
  return member ? member.status : null;
};

const sortByOrder = (requires, order) => {
  return order.map((id) => requires.find((require) => require._id.equals(id)));
};

module.exports = {
  isDone,
  getRequireStatusParams,
  isAuthor,
  getMemberStatus,
  sortByOrder,
};
