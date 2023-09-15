const Manager = require('../models/Manager');
const Pupil = require('../models/Pupil');
const Lecturers = require('../models/Lecturers');

const getAccountInfo = async (accountId, permission) => {
  switch (permission) {
    case process.env.PERMISSION_MANAGER:
      const managerInfo = await Manager.findOne({
        account_id: accountId,
      });

      return {
        account_id: accountId,
        permission: permission,
        ...managerInfo._doc,
      };

    case process.env.PERMISSION_LECTURERS:
      const lecturersInfo = await Lecturers.findOne({
        account_id: accountId,
      });
      return {
        account_id: accountId,
        permission: permission,
        ...lecturersInfo._doc,
      };

    case process.env.PERMISSION_PUPIL:
      const pupilInfo = await Pupil.findOne({
        account_id: accountId,
      });
      return {
        account_id: accountId,
        permission: permission,
        ...pupilInfo._doc,
      };

    default:
      return {
        account_id: accountId,
        permission: permission,
      };
  }
};

module.exports = {
  getAccountInfo,
};
