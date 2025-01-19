const { Server } = require('socket.io');
let io = null;

function initialize(server) {
    io = new Server(server, {
        cors: {
            origin: "*",
            methods: ['GET', 'POST'],
        },
    });

    io.on('connection', (socket) => {
        console.log('Client connected:', socket.id);

        socket.on('joinRoom', (roomId) => {
            console.log(`Client ${socket.id} joined room: ${roomId}`);
            socket.join(roomId);
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
        });
    });
}

// Emit an event to all connected clients
function emitEvent(event, data) {
    if (io) {
        io.emit(event, data);
    } else {
        console.error('Socket.IO is not initialized.');
    }
}

function emitToRoom(roomId, event, data) {
    if (io) {
        io.to(roomId).emit(event, data);
    } else {
        console.error('Socket.IO is not initialized.');
    }
}

module.exports = {
    initialize,
    emitEvent,
    emitToRoom
};
