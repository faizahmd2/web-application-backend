const DatabaseService = require('../db');
const dbService = new DatabaseService();
const collectionName = process.env.file_sharing_app_collection || 'file-sharing-app';

var storage = {
    createFileMetadata: async function(uniqueId, fileData) {
        const collection = await dbService.getCollection(collectionName);

        await collection.insertOne({
            ...fileData,
            uniqueId,
            expire: new Date(Date.now() + fileData.expiryMinutes * 60 * 1000)
        });
    },
    listFiles: async function(uniqueId) {
        const collection = await dbService.getCollection(collectionName);
        const documents = await collection.find(
            {
                uniqueId,
                expire: { $gt: new Date() }
            },
            {
                projection: {
                    uniqueId: 1,
                    fileKey: 1,
                    expire: 1,
                    originalName: 1,
                    size: 1
                }
            }
        ).toArray();
        return documents;
    },
    deleteMetadata: async function(uniqueId, fileKey) {
        const collection = await dbService.getCollection(collectionName);
        await collection.deleteOne({ uniqueId, fileKey });
    },
    getCollection: async function() {
        const collection = await dbService.getCollection(collectionName);
        return collection;
    },
    getExpiredFiles: async function () {
        const collection = await dbService.getCollection(collectionName);

        // Find expired files
        const expiredFiles = await collection.find(
            {
                expire: { $lt: new Date() }
            },
            {
                projection: { fileKey: 1, _id: 1 }
            }
        ).toArray();

        return expiredFiles;
    }

}

module.exports = storage;