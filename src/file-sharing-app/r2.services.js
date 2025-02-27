const { Upload } = require('@aws-sdk/lib-storage');
const s3Client = require('./r2.config');
const { GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

class R2Service {
    static async uploadFile(bucket, key, body, contentType) {
        const parallelUploads3 = new Upload({
            client: s3Client,
            params: {
                Bucket: bucket,
                Key: key,
                Body: body,
                ContentType: contentType
            },
            partSize: 5 * 1024 * 1024 // 5MB chunks
        });

        return parallelUploads3.done();
    }

    static async generatePresignedUrl(key, originalName) {
        const command = new GetObjectCommand({
            Bucket: process.env.R2_BUCKET,
            Key: key,
            ResponseContentDisposition: `attachment; filename="${originalName}"`,
        });

        return await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // Expiry time in seconds
    }

    static async deleteFile(bucket, key) {
        return s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    }
}

module.exports = R2Service;