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

app.listen(process.env.PORT, () =>
  console.log('Server started on port', process.env.PORT),
);
