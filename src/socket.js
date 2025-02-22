const { Server } = require('socket.io');
const axios = require('axios');
let io = null;
const editorStorage = require('./collaborative-editor/inMemoryStorage');

function initialize(server) {
    io = new Server(server, {
        cors: {
            origin: "*",
            methods: ['GET', 'POST'],
        },
    });

    io.on('connection', (socket) => {
        socket.on('joinRoom', (roomId) => {
            console.log(`Client ${socket.id} joined room: ${roomId}`);
            socket.join(roomId);
        });

        socket.on('join-editor', (editorId) => {
            console.log(`Client ${socket.id} joined editor: ${editorId}, ${editorStorage.getConnectionCount(editorId)}`);
            if (!editorId) return;

            // Join the room for this editorId
            socket.join(editorId);
            editorStorage.addConnection(editorId);

            if(editorStorage.getConnectionCount(editorId) > 1) {
                sendContentUpdate();
            } else {
                io.to(editorId).emit('fetch-initial-content', true);
            }

            // Listen for content changes
            socket.on('content-change', (newContent) => {
                editorStorage.setContent(editorId, newContent);
                io.to(editorId).emit('content-update', newContent);
            });

            socket.on('set-api-content', () => {
                if(editorStorage.getConnectionCount(editorId) <= 1) sendContentUpdate();
            });

            function sendContentUpdate() {
                const existingContent = editorStorage.getContent(editorId);
                socket.emit('content-update', existingContent);
            }

            // Handle disconnection
            socket.on('disconnect', async () => {
                const remainingConnections = editorStorage.removeConnection(editorId);

                // If no more active connections, clear the editor content
                if (remainingConnections === 0) {
                    const finalContent = editorStorage.getContent(editorId);
                    if (finalContent && finalContent.trim() !== '') {
                        console.log("SAVING TO DB:");
                        await saveContentToAPI(editorId);
                    }

                    editorStorage.cleanup(editorId);
                }
            });
        });

        socket.on('disconnect', () => {
            // console.log('Client disconnected:', socket.id);
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

async function saveContentToAPI(editorId) {
    try {
        await axios.post(`${process.env.BASE_URL}/save-editor-content`, { id: editorId });
        console.log(`Content saved for editor ${editorId}`);
    } catch (error) {
        console.error(`Failed to save content for editor ${editorId}:`, error);
    }
}

module.exports = {
    initialize,
    emitEvent,
    emitToRoom,
    io
};
