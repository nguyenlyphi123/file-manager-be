const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const session = require('express-session');
require('./passport');

require('dotenv').config();

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

const connectDB = async () => {
  try {
    mongoose.set('strictQuery', false);
    await mongoose.connect(
      `mongodb+srv://${process.env.DB_USER_NAME}:${process.env.DB_PASSWORD}@file-manager.ohju8rl.mongodb.net/?retryWrites=true&w=majority`,
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      },
    );
    console.log('MongoDB connected');
  } catch (error) {
    console.log(error.message);
    process.exit(1);
  }
};

connectDB();

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

const io = require('socket.io')(server, {
  cors: {
    origin: process.env.ORIGIN,
    credentials: true,
  },
});

io.on('connection', (socket) => {
  console.log('New client connected: ', socket.id);

  let sender = null;

  socket.on('setup', (data) => {
    sender = data.id;
    socket.join(data.id);
    socket.emit('connected');
  });

  socket.on('join-room', (room) => {
    socket.join(room);
  });

  socket.on('send-message', (message) => {
    const { receiver } = message;

    receiver.forEach((receive) => {
      if (receive._id === sender) return;

      socket.to(receive._id).emit('receive-message', message);
    });
  });

  socket.on('typing', (room) => {
    socket.to(room).emit('typing');
  });

  socket.on('stop-typing', (room) => {
    socket.to(room).emit('stop-typing');
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });

  socket.on('send-require', (require) => {
    const { to, author, endDate, startDate, file_type, message, note, title } =
      require;

    if (!to) return;

    const responseData = {
      author,
      endDate,
      startDate,
      file_type,
      message,
      note,
      title,
    };

    const receiverIds = to.map((receiver) => receiver.info);

    receiverIds.forEach((id) => {
      socket.to(id).emit('receive-require', responseData);
    });
  });
});
