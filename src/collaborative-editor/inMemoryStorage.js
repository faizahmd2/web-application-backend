class EditorStorage {
    constructor() {
        this.content = {};
        this.connections = {};
    }

    getContent(editorId) {
        return this.content[editorId] || '';
    }

    setContent(editorId, newContent) {
        this.content[editorId] = newContent;
    }

    addConnection(editorId) {
        this.connections[editorId] = (this.connections[editorId] || 0) + 1;
    }

    removeConnection(editorId) {
        if (this.connections[editorId]) {
            this.connections[editorId]--;
        }
        return this.connections[editorId];
    }

    getConnectionCount(editorId) {
        return this.connections[editorId]
    }

    cleanup(editorId) {
        delete this.content[editorId];
        delete this.connections[editorId];
        console.log(`Cleared content for editorId: ${editorId}`);
    }
}

module.exports = new EditorStorage();