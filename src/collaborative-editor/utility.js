const crypto = require('crypto');
const zlib = require('zlib');
const util = require('util');

const compress = util.promisify(zlib.deflate);
const decompress = util.promisify(zlib.inflate);

// Key must be exactly 32 bytes (256 bits)
const ENCRYPTION_KEY = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'your-password', 'salt', 32);
const IV_LENGTH = 16;

async function encrypt(text) {
    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
        // Convert text to string if it isn't already
        const textString = text.toString();
        let encrypted = cipher.update(textString, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
        console.error('Encryption error:', error);
        throw error;
    }
}

async function decrypt(text) {
    try {
        const parts = text.split(':');
        if (parts.length !== 2) throw new Error('Invalid encrypted text format');

        const iv = Buffer.from(parts[0], 'hex');
        const encryptedText = parts[1];
        const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        console.error('Decryption error:', error);
        throw error;
    }
}

module.exports = {
    compress,
    decompress,
    encrypt,
    decrypt
};