const mongoose = require('mongoose');

module.exports = async () => {
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

  await connectDB();
};
