const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');

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
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(cookieParser());

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

const server = app.listen(process.env.PORT, () =>
  console.log('Server started on port', process.env.PORT),
);

const io = require('socket.io')(server, {
  cors: {
    origin: 'http://localhost:3000',
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
    console.log('User joined room', room);
  });

  socket.on('send-message', (message) => {
    const { receiver } = message;

    console.log(message);

    receiver.forEach((receive) => {
      if (receive._id === sender) return;

      socket.to(receive._id).emit('receive-message', message);
    });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});
