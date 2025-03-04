const multer = require('multer');
const { handleFileUpload, listFiles, deleteFile, getFileSharingApp, download, cleanupExpiredFiles } = require('./fileController');
const ApiCronService = require('../api-cron');

// File upload configuration
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 }
});

// file cleanup cron job
const cleanupService = new ApiCronService({
    apiEndpoint: process.env.BASE_URL + '/file-sharing-app/cleanup',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    cronSchedule: '0 */6 * * *' // Every 6 hours
});

cleanupService.start();

module.exports = (app) => {
    app.get('/file-sharing-app', getFileSharingApp);
    app.post('/file-sharing-app/upload', upload.single('file'), handleFileUpload);
    app.get('/file-sharing-app/files', listFiles);
    app.get('/file-sharing-app/cleanup', cleanupExpiredFiles);
    app.get('/file-sharing-app/download/:fileKey', download);
    app.delete('/file-sharing-app/remove/:fileKey', deleteFile);
}
