const socketIO = require('socket.io');

module.exports = (server, options) => {
  const io = socketIO(server, options);

  io.on('connection', (socket) => {
    console.log(`New client connected: ${socket.id}`);

    let sender = null;

    io.on('setup', (data) => {
      sender = data.id;
      socket.join(data.id);
      socket.emit('connected');
    });

    io.on('join-room', (room) => {
      socket.join(room);
    });

    io.on('send-message', (message) => {
      const { receiver } = message;

      receiver.forEach((receive) => {
        if (receive._id === sender) return;

        socket.to(receive._id).emit('receive-message', message);
      });
    });

    io.on('typing', (room) => {
      socket.to(room).emit('typing');
    });

    io.on('stop-typing', (room) => {
      socket.to(room).emit('stop-typing');
    });

    io.on('disconnect', () => {
      console.log('Client disconnected');
    });

    io.on('send-require', (require) => {
      const {
        to,
        author,
        endDate,
        startDate,
        file_type,
        message,
        note,
        title,
      } = require;

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
};
