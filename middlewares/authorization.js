const jwt = require('jsonwebtoken');

const authorization = {
  authorizeUser: (req, res, next) => {
    const token = req.cookies.accessToken;

    if (!token)
      return res.status(401).json({ message: 'You are not authenticated' });

    try {
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, data) => {
        if (err)
          return res
            .status(403)
            .json({ message: 'Invalid token or token was expired' });

        req.user = data;
        next();
      });
    } catch (error) {
      return res.status(403).json({ message: 'Invalid token' });
    }
  },

  authorizeLecturers: (req, res, next) => {
    this.authorizeUser(req, res, () => {
      if (!req.user.permission === process.env.PERMISSION_LECTURERS)
        return res
          .status(403)
          .json({ message: 'You are not authorized to do this' });

      req.user = data;
      next();
    });
  },

  authorizeManager: (req, res, next) => {
    this.authorizeUser(req, res, () => {
      if (!req.user.permission === process.env.PERMISSION_MANAGER)
        return res
          .status(403)
          .json({ message: 'You are not authorized to do this' });

      req.user = data;
      next();
    });
  },
};

module.exports = authorization;
