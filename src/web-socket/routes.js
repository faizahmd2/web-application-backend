const events = require('./events');

module.exports = (app) => {
    // Webhook Endpoint
    app.post('/api/webhook/:eventName', events.webhookEventWithData);
    app.post('/api/webhook/:eventName/:roomId', events.webhookToRoomWithData);

    // Event without data
    app.get('/api/socket/:eventName/:roomId', events.socketRoomEventTrigger);
    app.get('/api/socket/:eventName', events.socketEventTrigger);
}