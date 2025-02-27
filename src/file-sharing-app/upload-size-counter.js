const fs = require('fs').promises;
const path = require('path');

class SimpleDailyCounter {
  constructor(options = {}) {
    this.cacheFile = options.cacheFile || path.join(process.cwd(), 'counter-cache.json');

    this.cache = {};

    this.hasLoadedFromFile = false;
  }

  _getTodayKey() {
    return new Date().toISOString().split('T')[0];
  }

  _getFullKey(baseKey) {
    const today = this._getTodayKey();
    return `${baseKey}:${today}`;
  }

  async _ensureCacheLoaded() {
    if (this.hasLoadedFromFile) {
      return;
    }

    try {
      const data = await fs.readFile(this.cacheFile, 'utf8');
      console.log("READING FILE:",data);
      const loaded = JSON.parse(data);

      const today = this._getTodayKey();

      Object.keys(loaded || {}).forEach(key => {
        if (key.endsWith(`:${today}`)) {
          this.cache[key] = loaded[key];
        }
      });

      this.hasLoadedFromFile = true;
    } catch (err) {
      if (err.code === 'ENOENT' || err instanceof SyntaxError) {
        this.cache = {};
      } else {
        console.error('Error loading cache from file:', err);
      }
      this.hasLoadedFromFile = true;
    }
  }

  async _saveToFile() {
    try {
      const today = this._getTodayKey();
      const dataToSave = {};

      Object.keys(this.cache).forEach(key => {
        if (key.endsWith(`:${today}`)) {
          dataToSave[key] = this.cache[key];
        }
      });

      console.log("WRITING FILE:",JSON.stringify(dataToSave));
      await fs.writeFile(this.cacheFile, JSON.stringify(dataToSave), 'utf8');
      return true;
    } catch (err) {
      return false;
    }
  }

  async get(baseKey) {
    await this._ensureCacheLoaded();
    const key = this._getFullKey(baseKey);
    return this.cache[key] || 0;
  }

  async set(baseKey, value) {
    await this._ensureCacheLoaded();
    const key = this._getFullKey(baseKey);
    this.cache[key] = value;
    await this._saveToFile();
    return value;
  }

  async increment(baseKey, incrementBy) {
    const currentValue = await this.get(baseKey);
    const newValue = currentValue + incrementBy;
    return await this.set(baseKey, newValue);
  }

  async isLimitReached(baseKey, limit) {
    const value = await this.get(baseKey);
    return value >= limit;
  }

  async reset(baseKey) {
    return await this.set(baseKey, 0);
  }
}

module.exports = new SimpleDailyCounter();