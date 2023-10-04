const isAuthor = (uid, aid) => {
  if (!uid || !aid) return false;

  return uid.toString() === aid.toString();
};

module.exports = {
  isAuthor,
};
