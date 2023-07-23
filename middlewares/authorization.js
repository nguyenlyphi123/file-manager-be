const jwt = require('jsonwebtoken');

const authorization = {
  authorizeUser: (req, res, next) => {
    // const authHeader = req.header('Authorization');

    const token = req.cookies.accessToken;
    // console.log(token);

    if (!token)
      return res.status(401).json({ message: 'You are not authenticated' });

    try {
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, data) => {
        if (err)
          return res
            .status(403)
            .json({ message: 'Invalid token or token was expired' });

        req.data = data;
        next();
      });
    } catch (error) {
      return res.status(403).json({ message: 'Invalid token' });
    }
  },

  authorizeLecturers: (req, res, next) => {
    // const authHeader = req.header('Authorization');

    // if (!authHeader)
    //   return res.status(401).json({ message: 'You are not authenticated' });

    // const token = authHeader.split(' ')[1];

    // try {
    //   jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, data) => {
    //     if (err) return res.status(401).json({ message: 'Invalid token' });

    //     if (!data.lecturers)
    //       return res
    //         .status(403)
    //         .json({ message: 'You are not alow to do this' });

    //     req.data = data;
    //     next();
    //   });
    // } catch (error) {
    //   return res.status(403).json({ message: 'Invalid token' });
    // }

    this.authorizeUser(req, res, () => {
      if (!req.data.lecturers)
        return res
          .status(403)
          .json({ message: 'You are not authorized to do this' });

      req.data = data;
      next();
    });
  },
};

module.exports = authorization;
