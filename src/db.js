const { MongoClient } = require('mongodb');

class DatabaseService {
  #client = null;
  #db = null;

  async connect() {
    if (this.#db) return this.#db;
    console.log("DB NOT FOUND getting from connection");

    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is not defined in the environment variables');
    }

    this.#client = new MongoClient(process.env.MONGO_URI);
    await this.#client.connect();
    this.#db = this.#client.db('web-application-backend');
    return this.#db;
  }

  async getCollection(name) {
    const db = await this.connect();
    return db.collection(name);
  }
}

module.exports = DatabaseService;