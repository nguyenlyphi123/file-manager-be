const mongoose = require('mongoose');

const connectStr = `mongodb+srv://${process.env.DB_USER_NAME}:${process.env.DB_PASSWORD}@file-manager.ohju8rl.mongodb.net/?retryWrites=true&w=majority`;

class Database {
  constructor() {
    this._connect();
  }

  _connect() {
    mongoose
      .connect(connectStr, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      })
      .then(() => {
        console.log('MongoDB connected');
      })
      .catch((err) => {
        console.error('Connection error', err.message);
      });
  }

  static getInstance() {
    if (!Database.instance) {
      Database.instance = new Database();
    }

    return Database.instance;
  }
}

const instance = Database.getInstance();

module.exports = instance;
