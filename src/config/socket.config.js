const { Server } = require('socket.io');

let io;

// Initialize Socket.IO server
const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:3000"],
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true
  });

  // Connection event handler
  io.on('connection', (socket) => {
    console.log(`🔌 User connected: ${socket.id}`);

    // Join user to their personal room
    socket.on('join-user-room', (userId) => {
      socket.join(`user-${userId}`);
      console.log(`👤 User ${userId} joined their room`);
    });

    // Join admin room
    socket.on('join-admin-room', () => {
      socket.join('admin-room');
      console.log(`👨‍💼 Admin joined admin room`);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`🔌 User disconnected: ${socket.id}`);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });

  console.log('✅ Socket.IO server initialized');
  return io;
};

// Get Socket.IO instance
const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initializeSocket first.');
  }
  return io;
};

// Send notification to specific user
const sendNotificationToUser = (userId, notification) => {
  try {
    const socketIO = getIO();
    socketIO.to(`user-${userId}`).emit('notification', notification);
    console.log(`📨 Notification sent to user ${userId}`);
  } catch (error) {
    console.error('Error sending notification to user:', error);
  }
};

// Send notification to admin room
const sendNotificationToAdmin = (notification) => {
  try {
    const socketIO = getIO();
    socketIO.to('admin-room').emit('admin-notification', notification);
    console.log('📨 Notification sent to admin room');
  } catch (error) {
    console.error('Error sending notification to admin:', error);
  }
};

// Broadcast to all connected users
const broadcastToAll = (event, data) => {
  try {
    const socketIO = getIO();
    socketIO.emit(event, data);
    console.log(`📢 Broadcast sent: ${event}`);
  } catch (error) {
    console.error('Error broadcasting:', error);
  }
};

// Get connected users count
const getConnectedUsersCount = () => {
  try {
    const socketIO = getIO();
    return socketIO.engine.clientsCount;
  } catch (error) {
    console.error('Error getting connected users count:', error);
    return 0;
  }
};

module.exports = {
  initializeSocket,
  getIO,
  sendNotificationToUser,
  sendNotificationToAdmin,
  broadcastToAll,
  getConnectedUsersCount
};
