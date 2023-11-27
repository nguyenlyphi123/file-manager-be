const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const session = require('express-session');

require('dotenv').config();

require('./passport');
require('./libs/connectDB')();

const majorRouter = require('./routes/major_routes');
const specializationRouter = require('./routes/specialization_routes');
const authenticationRouter = require('./routes/authentication_routes');
const folderRouter = require('./routes/folder_routes');
const fileRouter = require('./routes/file_routes');
const gcRouter = require('./routes/gc_routes');
const classRouter = require('./routes/class_routes');
const pupilRouter = require('./routes/pupil_routes');
const lecturersRouter = require('./routes/lecturers_routes');
const chatRouter = require('./routes/chat_routes');
const messageRouter = require('./routes/message_routes');
const accountRouter = require('./routes/account_routes');
const requireRouter = require('./routes/require_routes');
const searchRouter = require('./routes/search_routes');
const informationRouter = require('./routes/information_routes');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: process.env.ORIGIN,
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(
  session({ secret: 'keyboard cat', resave: true, saveUninitialized: true }),
);
app.use(passport.initialize());
app.use(passport.session());

app.use('/api/major', majorRouter);
app.use('/api/specialization', specializationRouter);
app.use('/api/authentication', authenticationRouter);
app.use('/api/folder', folderRouter);
app.use('/api/file', fileRouter);
app.use('/api/gc', gcRouter);
app.use('/api/class', classRouter);
app.use('/api/pupil', pupilRouter);
app.use('/api/lecturers', lecturersRouter);
app.use('/api/chat', chatRouter);
app.use('/api/message', messageRouter);
app.use('/api/account', accountRouter);
app.use('/api/require', requireRouter);
app.use('/api/search', searchRouter);
app.use('/api/information', informationRouter);

const server = app.listen(process.env.PORT, () =>
  console.log('Server started on port', process.env.PORT),
);

require('./modules/socket')(server, {
  cors: {
    origin: process.env.ORIGIN,
    credentials: true,
  },
});
