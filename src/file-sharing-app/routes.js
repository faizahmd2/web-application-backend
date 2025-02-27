const multer = require('multer');
const { handleFileUpload, listFiles, deleteFile, getFileSharingApp, download } = require('./fileController');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 }
});

module.exports = (app) => {
    app.get('/file-sharing-app', getFileSharingApp);
    app.post('/file-sharing-app/upload', upload.single('file'), handleFileUpload);
    app.get('/file-sharing-app/files', listFiles);
    app.get('/file-sharing-app/download/:fileKey', download);
    app.delete('/file-sharing-app/remove/:fileKey', deleteFile);
}
