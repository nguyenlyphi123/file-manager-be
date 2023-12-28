const { Types } = require('mongoose');

const Information = require('../models/Information');
const Specialization = require('../models/Specialization');
const { transferSelection } = require('./hepler');

// get information by id
const getInformationById = async (id) => {
  const information = await Information.aggregate([
    {
      $match: {
        account_id: new Types.ObjectId(id),
      },
    },
    {
      $lookup: {
        from: 'accounts',
        localField: 'account_id',
        foreignField: '_id',
        as: 'account',
      },
    },
    {
      $lookup: {
        from: 'majors',
        localField: 'major',
        foreignField: '_id',
        as: 'major',
      },
    },
    {
      $lookup: {
        from: 'specializations',
        localField: 'specialization',
        foreignField: '_id',
        as: 'specialization',
      },
    },
    {
      $lookup: {
        from: 'information',
        localField: 'mentor',
        foreignField: 'account_id',
        as: 'mentor',
      },
    },
    {
      $unwind: {
        path: '$account',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $unwind: {
        path: '$major',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $unwind: {
        path: '$mentor',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $replaceWith: {
        _id: '$account._id',
        name: '$name',
        email: '$email',
        image: '$image',
        permission: '$account.permission',
        major: '$major',
        specialization: '$specialization',
        class: '$class',
        mentor: '$mentor',
        createAt: '$createAt',
        modifiedAt: '$modifiedAt',
      },
    },
    {
      $project: {
        _id: 1,
        name: 1,
        email: 1,
        image: 1,
        permission: 1,
        major: {
          _id: 1,
          name: 1,
        },
        specialization: {
          _id: 1,
          name: 1,
        },
        class: 1,
        mentor: {
          _id: 1,
          name: 1,
          email: 1,
          image: 1,
        },
        createAt: 1,
        modifiedAt: 1,
      },
    },
  ]);

  return information?.[0];
};

// get list information
const getGroupedInformationList = async (majorId) => {
  const [specializations, managers, unsignedPupils] = await Promise.all([
    Specialization.find(majorId ? { major: majorId } : {}),
    getManagerInformation(majorId),
    getMemberInformationByManagerIdAndSpecId(null, null, [
      '_id',
      'name',
      'email',
      'image',
      'role',
    ]),
  ]);

  const specializeMapping = {};

  await Promise.all(
    managers.map(async (manager) => {
      const { specialization } = manager;

      for (const specialize of specialization) {
        if (!specializeMapping[specialize]) {
          specializeMapping[specialize] = [];
        }

        const pupils = await getMemberInformationByManagerIdAndSpecId(
          manager._id,
          specialize,
          ['_id', 'name', 'email', 'image', 'role'],
        );

        specializeMapping[specialize].push({ ...manager, members: pupils });
      }
    }),
  );

  const result = [
    {
      name: 'Unsigned Members',
      members: unsignedPupils.length ? unsignedPupils : [],
    },
    ...specializations.map((specialize) => {
      return {
        _id: specialize._id,
        name: specialize.name,
        major: specialize.major,
        members: specializeMapping[specialize._id],
      };
    }),
  ];

  return result;
};

const getManagerInformation = async (majorId) => {
  const managers = await Information.aggregate([
    {
      $lookup: {
        from: 'accounts',
        localField: 'account_id',
        foreignField: '_id',
        as: 'account',
      },
    },
    {
      $unwind: {
        path: '$account',
        preserveNullAndEmptyArrays: false,
      },
    },
    {
      $match: majorId
        ? {
            'account.permission': process.env.PERMISSION_MANAGER,
            'major': new Types.ObjectId(majorId),
          }
        : { 'account.permission': process.env.PERMISSION_MANAGER },
    },
    {
      $project: {
        account: {
          password: 0,
          __v: 0,
          modifiedAt: 0,
          createAt: 0,
          info: 0,
          lastSigned: 0,
        },
      },
    },
    {
      $replaceWith: {
        _id: '$account._id',
        name: '$name',
        email: '$email',
        image: '$image',
        major: '$major',
        specialization: '$specialization',
      },
    },
  ]);

  return managers;
};

const getMemberInformationByManagerIdAndSpecId = async (
  managerId,
  specId,
  select,
) => {
  const pupils = await Information.aggregate([
    {
      $lookup: {
        from: 'accounts',
        localField: 'account_id',
        foreignField: '_id',
        as: 'account',
      },
    },
    {
      $unwind: {
        path: '$account',
        preserveNullAndEmptyArrays: false,
      },
    },
    {
      $match: {
        'account.permission': {
          $nin: [process.env.PERMISSION_ADMIN, process.env.PERMISSION_MANAGER],
        },
        // 'mentor': managerId ? new Types.ObjectId(managerId) : null,
        'specialization': specId ? new Types.ObjectId(specId) : [],
      },
    },
    {
      $replaceWith: {
        _id: '$account._id',
        role: '$account.permission',
        name: '$name',
        email: '$email',
        image: '$image',
      },
    },
    {
      $project: transferSelection(select),
    },
  ]);

  return pupils;
};

// get list mentor with specialization
const getMentorsInformationWithSpecId = async (specId) => {
  const mentors = await Information.aggregate([
    {
      $lookup: {
        from: 'accounts',
        localField: 'account_id',
        foreignField: '_id',
        as: 'account',
      },
    },
    {
      $unwind: {
        path: '$account',
        preserveNullAndEmptyArrays: false,
      },
    },
    {
      $match: {
        'account.permission': process.env.PERMISSION_LECTURERS,
        'specialization': specId ? new Types.ObjectId(specId) : [],
      },
    },
    {
      $replaceWith: {
        _id: '$account._id',
        name: '$name',
        email: '$email',
        image: '$image',
      },
    },
  ]);

  return mentors;
};

module.exports = {
  getGroupedInformationList,
  getMentorsInformationWithSpecId,
  getInformationById,
};
