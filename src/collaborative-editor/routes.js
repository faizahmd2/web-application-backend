const handler = require('./editorHandler');

module.exports = (app) => {
    app.get('/collaborative-editor', handler.getEditorPage);

    app.get('/load-editor-content/:id', handler.getEditorContent);

    app.post('/save-editor-content', handler.saveEditorContent);

    app.delete('/destroy-editor-content/:id', handler.destroyEditorContent);
}