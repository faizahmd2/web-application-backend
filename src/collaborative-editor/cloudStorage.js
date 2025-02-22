const { encrypt, decrypt, compress, decompress } = require('./utility');
const DatabaseService = require('../db');
const dbService = new DatabaseService();

var cloudStorage = {
  getEditorContent: async (id) => {
    try {
      // id = await encrypt(id);
      // console.log("encryptedId::",id);

      // Fetch content from MongoDB
      const collection = await dbService.getCollection('editor_content');
      const result = await collection.findOne({ id });

      if (!result) {
        return { content: null };
      }

      const encryptedContent = result.content;
      const decrypted = await decrypt(encryptedContent);
      const decompressed = await decompress(Buffer.from(decrypted, 'base64'));

      return { content: decompressed.toString() };
    } catch (error) {
      console.error('Load error:', error.message);
      return { error: "Error occured" };;
    }
  },
  saveEditorContent: async (id, content) => {
    try {
      if (!id || !content) {
        return { error: 'ID and content are required' };
      }

      // Compress and encrypt the content
      const compressed = await compress(Buffer.from(content));
      const encrypted = await encrypt(compressed.toString('base64'));

      // Save content to MongoDB
      const collection = await dbService.getCollection('editor_content');
      await collection.updateOne({ id }, { $set: { id, content: encrypted, created: new Date } }, { upsert: true });

      return {};
    } catch (error) {
      console.error('Save error:', error.message);
      return { error: 'Failed to save content' };
    }
  }
};

module.exports = cloudStorage;