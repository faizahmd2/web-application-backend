const socketServer = require('./socket');

var controllers = {
    socketEventTrigger: function(req, res) {
        const { eventName } = req.params;

        console.log(`Emitting event "${eventName}" with data:`);
        socketServer.emitEvent(eventName, 1);

        res.status(200).json({ message: `Event ${eventName} triggered!` });
    },
    socketRoomEventTrigger: function(req, res) {
        const { eventName, roomId } = req.params;

        console.log(`Emitting event "${eventName}" with data to the room: ${roomId}`);
        socketServer.emitToRoom(roomId, eventName, 1);

        res.status(200).json({ message: `Event ${eventName} triggered to the room ${roomId}!` });
    },
    webhookToRoomWithData: function(req, res) {
        const { roomId, eventName } = req.params;
        const body = req.body;

        console.log(`Emitting event "${eventName}" to room: ${roomId} with data:`, body);
        socketServer.emitToRoom(roomId, eventName, body);

        res.status(200).json({ message: "Recieved!" });
    },
    webhookEventWithData: function(req, res) {
        const { eventName } = req.params;
        const body = req.body;

        console.log(`Emitting event "${eventName}" with data:`, body);
        socketServer.emitEvent(eventName, body);

        res.status(200).json({ message: `Recieved!` });
    }
}

module.exports = controllers;