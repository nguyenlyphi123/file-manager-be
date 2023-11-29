const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const session = require('express-session');
const { default: helmet } = require('helmet');
const compression = require('compression');

require('dotenv').config();

require('./passport');
require('./databases/init.mongodb');
const socket = require('./modules/socket');
const { NotFoundError, errorHandler } = require('./core/error.response');

const app = express();

// middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: process.env.ORIGIN,
    credentials: true,
  }),
);
app.use(helmet());
app.use(compression());
app.use(cookieParser());
app.use(
  session({ secret: 'keyboard cat', resave: true, saveUninitialized: true }),
);
app.use(passport.initialize());
app.use(passport.session());

// routes
app.use('/', require('./routes'));
app.use((req, res, next) => {
  const error = new Error('Not found');
  error.status = 404;
  next(error);
});
app.use(errorHandler);

const server = app.listen(process.env.PORT, () =>
  console.log('Server started on port', process.env.PORT),
);

// socket
socket(server, {
  cors: {
    origin: process.env.ORIGIN,
    credentials: true,
  },
});
