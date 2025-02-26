const shortid = require('shortid');
const inMemoryStorage = require('./inMemoryStorage');
const cloudStorage = require('./cloudStorage');

var handler = {
    getEditorPage: (req, res) => {
        if(req.query.id) {
            res.sendFile(appRoot + '/site/editor/index.html');
        } else {
            const editorId = shortid.generate();
            res.redirect(`/collaborative-editor?id=${editorId}`);
        }
    },
    getEditorContent: async (req, res) => {
        try {
            const { id } = req.params;

            const memoryContent = inMemoryStorage.getContent(id);
            if (memoryContent) {
                return res.json({ success: true });
            }

            const contentFetch = await cloudStorage.getEditorContent(id);
            // console.log("CLOUD cont:",contentFetch);
            if(contentFetch.error) {
                return res.json({ success: false });
            }

            inMemoryStorage.setContent(id, contentFetch.content);

            res.json({ success: true });
        } catch (error) {
            console.error('Load error:', error.message);
            res.json({ success: false, error: 'Failed to load content' });
        }
    },
    saveEditorContent: async (req, res) => {
        try {
            const { id } = req.body;

            const content = inMemoryStorage.getContent(id);

            if(!content) return res.json({ });

            await cloudStorage.saveEditorContent(id, content);

            // console.log("SAVE CONTENT IN DB DONE -",id);
            res.json({ });
        } catch (error) {
            console.error('Save error:', error.message);
            res.json({ error: 'Failed to save content' });
        }
    },
    destroyEditorContent: async (req, res) => {
        try {
            const { id } = req.params;
            // const baseUrl = req.protocol + "://" + req.get("host");

            inMemoryStorage.cleanup(id);

            await cloudStorage.destroyEditorContent(id);

            res.json({"redirect": "/editor/close.html"});
        } catch (error) {
            console.error('Save error:', error.message);
            res.json({ error: 'Failed to save content' });
        }
    }
}

module.exports = handler;