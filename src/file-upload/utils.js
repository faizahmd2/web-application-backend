const B2 = require('backblaze-b2');
const cache = require('memory-cache');
const mime = require('mime-types');
const { formidable } = require('formidable');
const fs = require('fs');
const crypto = require('crypto');

class B2Handler {
  constructor() {
    this.b2 = new B2({
      applicationKeyId: process.env.B2_APPLICATION_KEY_ID,
      applicationKey: process.env.B2_APPLICATION_KEY
    });
    this.isAuthorized = false;
    this.MAX_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
    this.MAX_STORAGE = 9 * 1024 * 1024 * 1024; // 9GB in bytes
  }

  async initialize() {
    try {
      await this.b2.authorize();
      console.log('Authorization successful');

      const response = await this.b2.getBucket({ bucketName: process.env.B2_BUCKET_NAME });
      const bucket = response.data.buckets.find(bucket => bucket.bucketName === process.env.B2_BUCKET_NAME);

      if (!bucket) {
        throw new Error(`Bucket ${process.env.B2_BUCKET_NAME} not found`);
      }

      this.bucketId = bucket.bucketId;
      this.isAuthorized = true;
      console.log('B2 initialized successfully with bucket:', this.bucketId);
    } catch (error) {
      console.error('B2 initialization failed:', error.message);
      throw error;
    }
  }

  async ensureAuthorized() {
    if (!this.isAuthorized) {
      await this.initialize();
    }
  }

  calculateSha1(buffer) {
    return crypto.createHash('sha1').update(buffer).digest('hex');
  }

  async uploadSmallFile(fileName, buffer) {
    const response = await this.b2.getUploadUrl({
      bucketId: this.bucketId
    });

    const { uploadUrl, authorizationToken } = response.data;
    const contentType = mime.lookup(fileName) || 'application/octet-stream';

    console.log(`Uploading small file ${fileName} (${buffer.length} bytes)`);

    const uploadResponse = await this.b2.uploadFile({
      uploadUrl,
      uploadAuthToken: authorizationToken,
      fileName,
      data: buffer,
      contentType
    });

    return uploadResponse.data.fileId;
  }

  async uploadChunk(fileName, processed_file, buffer, partNumber) {
    if (buffer.length > this.MAX_CHUNK_SIZE) {
      throw new Error(`Chunk size exceeds maximum allowed size of ${this.MAX_CHUNK_SIZE} bytes`);
    }

    const sha1 = this.calculateSha1(buffer);
    console.log("sha1::",sha1.length);

    try {
      const { data: { uploadUrl, authorizationToken } } = await this.b2.getUploadPartUrl({
        fileId: processed_file.fileId
      });
      console.log("uploadUrl::",uploadUrl);
      console.log("authorizationToken::",authorizationToken);

      partNumber = +partNumber;
      const response = await this.b2.uploadPart({
        uploadUrl,
        uploadAuthToken: authorizationToken,
        partNumber,
        data: buffer
      });

      // Store the SHA1 hash for this part
      if(processed_file.totalParts > 1) {
        const cacheKey = `${processed_file.fileId}_part${partNumber}`;
        cache.put(cacheKey, sha1, 24 * 60 * 60 * 1000); // Cache for 24 hours
      }

      let uploadedInf = { ...processed_file, uploadedParts: partNumber };
      console.log("Puttig",fileName,uploadedInf);
      cache.put(fileName, uploadedInf, 24 * 60 * 60 * 1000);

      console.log(`Successfully uploaded part ${partNumber} for file ${processed_file.fileId}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to upload part ${partNumber}:`, error.message);
      throw error;
    }
  }

  getPartSha1Array(fileId, totalParts) {
    const sha1Array = [];
    for (let i = 1; i <= totalParts; i++) {
      const sha1 = cache.get(`${fileId}_part${i}`);
      if (!sha1) {
        throw new Error(`Missing SHA1 hash for part ${i}`);
      }
      sha1Array.push(sha1);
    }
    return sha1Array;
  }

  async manageB2Storage(bucketId, fileSize) {
    try {
      const response = await this.b2.listFileNames({
        bucketId: bucketId,
        maxFileCount: 10000
      });

      // Calculate total current storage
      let files = response.data.files;
      let totalStorage = files.reduce((sum, file) => sum + file.contentLength, 0);

      console.log(`Current storage usage: ${(totalStorage / 1024 / 1024 / 1024).toFixed(2)}GB`);

      const MAX_STORAGE = this.MAX_STORAGE;
      const hasExceededStorage = (totalStorage, fileSize) => totalStorage + fileSize > MAX_STORAGE;

      if (hasExceededStorage(totalStorage, fileSize)) {
        console.log('Storage limit would be exceeded. Removing older files...');

        // Sort files by uploadTimestamp
        files.sort((a, b) => a.uploadTimestamp - b.uploadTimestamp);

        // Remove oldest files until we have enough space
        while (hasExceededStorage(totalStorage, fileSize) && files.length > 0) {
          const oldestFile = files.shift();

          // Check if the file exists before attempting to delete
          const fileExists = files.some(file => file.fileId === oldestFile.fileId);
          if (fileExists) {
            // Delete the file
            await this.b2.deleteFileVersion({
              fileId: oldestFile.fileId,
              fileName: oldestFile.fileName
            });
            console.log(`Deleted: ${oldestFile.fileName}`);
            totalStorage -= oldestFile.contentLength;
          } else {
            console.log(`File ${oldestFile.fileName} already deleted`);
          }

          console.log(`Deleted: ${oldestFile.fileName}`);
          totalStorage -= oldestFile.contentLength;
        }
      }

      if (!hasExceededStorage(totalStorage, fileSize)) {
        console.log('Sufficient space available for upload');
        return true;
      } else {
        console.log('Unable to create enough space for new file');
        return false;
      }
    } catch (error) {
      console.error('Error managing storage:', error);
      throw error;
    }
  }
}

const b2Handler = new B2Handler();

const utils = {
  convertFormidableAndWriteStream: async function (request, currentPart) {
    return new Promise((resolve, reject) => {
      const form = formidable({
        maxFileSize: b2Handler.MAX_CHUNK_SIZE,
        keepExtensions: true
      });

      let tempFilePath;
      let fileId = request.processed_file.fileId;

      form.on('file', (fieldname, file) => {
        tempFilePath = file.filepath;
      });

      form.on('error', (error) => {
        console.error('Formidable error:', error.message);
        reject(error);
      });

      form.on('end', async () => {
        try {
          if (!tempFilePath || !fs.existsSync(tempFilePath)) {
            throw new Error('No file received or file not found');
          }

          const fileBuffer = fs.readFileSync(tempFilePath);
          if(request.processed_file.totalParts == 1)  {
            await b2Handler.uploadSmallFile(request.fileName, fileBuffer);
          } else {
            await b2Handler.uploadChunk(request.fileName, request.processed_file, fileBuffer, currentPart);
          }

          fs.unlinkSync(tempFilePath);
          resolve(fileId);
        } catch (error) {
          console.error('Error during chunk upload:', error.message);
          reject(error);
        }
      });

      request.on('aborted', () => {
        if (tempFilePath && fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
        reject(new Error('Request aborted'));
      });

      form.parse(request);
    });
  },

  handleUploadEvent: async function (fileName, type, fileSize, totalParts = 0) {
    await b2Handler.ensureAuthorized();

    const cacheValue = cache.get(fileName);
    let status = 0, message = "Invalid type - " + type;

    try {
      switch (type) {
        case 'start':
          if (cacheValue) {
            return { status: 0, message: "Upload already in progress" };
          }

          // Check for space availability
          let hasSpace = await b2Handler.manageB2Storage(b2Handler.bucketId, fileSize);
          if(!hasSpace) {
            return { status: 0, message: "Insufficient space available for upload" };
          }

          if(totalParts > 1) {
            const startResponse = await b2Handler.b2.startLargeFile({
              bucketId: b2Handler.bucketId,
              fileName,
              contentType: mime.lookup(fileName) || 'application/octet-stream'
            });

            const fileId = startResponse.data.fileId;

            // Store file metadata
            cache.put(fileName, {
              fileId,
              totalParts,
              uploadedParts: 0
            }, 24 * 60 * 60 * 1000); // 24 hours cache
            message = `Upload initiated for ${fileName} (ID: ${fileId})`;
          } else {
            // Store file metadata
            cache.put(fileName, {
              fileId: null,
              totalParts: 1,
              uploadedParts: 0
            }, 24 * 60 * 60 * 1000); // 24 hours cache
            message = `Upload initiated for ${fileName}`;
          }

          status = 1;
          break;

        case 'end':
          const fileData = cacheValue;
          if (!fileData) {
            return { status: 0, message: "No active upload found" };
          }

          console.log("On END fileData::",fileData);
          if(fileData.totalParts > 1) {
            const sha1Array = b2Handler.getPartSha1Array(fileData.fileId, fileData.totalParts);
            console.log("sha1Array::",sha1Array);

            const finishResponse = await b2Handler.b2.finishLargeFile({
              fileId: fileData.fileId,
              partSha1Array: sha1Array
            });
            console.log("finishResponse::",finishResponse);
          }

          // Clear all caches related to this file
          cache.del(fileName);
          for (let i = 1; i <= fileData.totalParts; i++) {
            cache.del(`${fileData.fileId}_part${i}`);
          }

          status = 1;
          message = `Upload completed for ${fileName}`;
          break;

        case 'drop':
          const dropFileData = cacheValue;
          if (!dropFileData) {
            return { status: 0, message: "No active upload found" };
          }

          if(dropFileData.totalParts > 1) {
            await b2Handler.b2.cancelLargeFile({
              fileId: dropFileData.fileId
            });
          }

          // Clear all caches
          cache.del(fileName);
          for (let i = 1; i <= dropFileData.totalParts; i++) {
            cache.del(`${dropFileData.fileId}_part${i}`);
          }

          status = 1;
          message = `Upload cancelled for ${fileName}`;
          break;

        default:
          return { status: 0, message: "Invalid upload event type" };
      }
    } catch (error) {
      console.error(`Upload event error (${type}):`, error);
      return {
        status: 0,
        message: `Operation failed: ${error.message}`
      };
    }

    return { status, message };
  },

  getUploadStatus: function(fileName) {
    return cache.get(fileName) || null;
  }
};

// Initialize B2 when the module loads
b2Handler.initialize();

module.exports = utils;