const informationRes = {
  _id: 1,
  name: 1,
  email: 1,
  image: 1,
  account_id: {
    _id: 1,
    username: 1,
    permission: 1,
  },
  major: {
    _id: 1,
    name: 1,
  },
  specialization: {
    _id: 1,
    name: 1,
  },
  class: {
    _id: 1,
    name: 1,
  },
};

const informationPopulateEx = {
  _id: 0,
  account_id: 0,
  major: 0,
  specialization: 0,
  class: 0,
  createAt: 0,
  modifiedAt: 0,
  __v: 0,
};

module.exports = {
  informationPopulateEx,
  informationRes,
};
