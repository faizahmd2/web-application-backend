const R2Service = require('./r2.services');
const fileStorage = require('./metadataStorage');
const shortid = require('shortid');
let dailyUploadLimit = +process.env.R2_DAILY_UPLOAD_LIMIT || 8; // GB
dailyUploadLimit = dailyUploadLimit * 1024; // Byte
let cacheCounter = require('./upload-size-counter');
let cacheKey = "upload";

const getFileSharingApp = async function(req,res) {
    if(req.query.uniqueId) {
        res.sendFile(appRoot + '/site/share-file/index.html');
    } else {
        const uniqueId = shortid.generate();
        res.redirect(`/file-sharing-app?uniqueId=${uniqueId}`);
    }
}

const handleFileUpload = async (req, res) => {
    try {
        if (!req.file || !req.query.uniqueId) return res.status(400).send('No file/id uploaded');

        const fileSize = req.file.size / 1024 / 1024; // Convert to MB
        if(fileSize > 100) return res.status(400).send('File Is Large!');

        let isLimitReached = await cacheCounter.isLimitReached(cacheKey, dailyUploadLimit);
        if(isLimitReached) return res.status(400).send('Todays limit reached, Please upload tomorrow!');

        const uniqueId = req.query.uniqueId;
        const fileKey = `${Date.now()}-${req.file.originalname}`;
        const expiryMinutes = parseInt(req.body.expiryMinutes) || 7;

        await R2Service.uploadFile(
            process.env.R2_BUCKET,
            fileKey,
            req.file.buffer,
            req.file.mimetype
        );

        await cacheCounter.increment(cacheKey, fileSize);

        await fileStorage.createFileMetadata(uniqueId, {
            fileKey,
            originalName: req.file.originalname,
            size: req.file.size,
            uploadDate: new Date().toISOString(),
            expiryMinutes
        });

        res.json({ uniqueId, fileKey });
    } catch (error) {
        res.status(500).send(error.message);
    }
};

const listFiles = async (req, res) => {
    try {
        const files = await fileStorage.listFiles(req.query.uniqueId);
        let disableUpload = await cacheCounter.isLimitReached(cacheKey, dailyUploadLimit);
        res.json({files, disableUpload});
    } catch (error) {
        res.status(500).send(error.message);
    }
};

const deleteFile = async (req, res) => {
    try {
        if(!req.query.uniqueId) return res.status(500).send("Missing ID");

        await R2Service.deleteFile(process.env.R2_BUCKET, req.params.fileKey);
        await fileStorage.deleteMetadata(req.query.uniqueId, req.params.fileKey);
        res.sendStatus(204);
    } catch (error) {
        res.status(500).send(error.message);
    }
};

const download = async (req, res) => {
    if(!req.params.fileKey) return res.send('');

    let fileName = req.query.fileName || req.params.fileKey;

    const file = await R2Service.generatePresignedUrl(req.params.fileKey, fileName);
    res.send(file);
}

const cleanupExpiredFiles = async (req, res) => {
    try {
        const files = await fileStorage.getExpiredFiles();
        const removedIds = [];

        for(let file of files) {
            console.log(`Removing expired file: ${file.fileKey}`);
            await R2Service.deleteFile(process.env.R2_BUCKET, file.fileKey);
            removedIds.push(file._id);
        }

        // Remove expired files from MongoDB
        let collection = await fileStorage.getCollection();
        console.log("Removed Files:",removedIds);
        await collection.deleteMany({ _id: { $in: removedIds } });
        res.json({removedIds});
    } catch (error) {
        res.status(500).send(error.message);
    }
};

module.exports = { getFileSharingApp, handleFileUpload, listFiles, deleteFile, download, cleanupExpiredFiles };