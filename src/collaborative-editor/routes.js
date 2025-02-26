const handler = require('./editorHandler');

module.exports = (app) => {
    app.get('/collaborative-editor', handler.getEditorPage);

    app.get('/collaborative-editor/load-content/:id', handler.getEditorContent);

    app.post('/collaborative-editor/save-content', handler.saveEditorContent);

    app.delete('/collaborative-editor/destroy-content/:id', handler.destroyEditorContent);

    app.get('/collaborative-editor/save-all-content', handler.saveAllContent);
}