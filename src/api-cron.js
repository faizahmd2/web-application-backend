const cron = require('node-cron');
const axios = require('axios');

class ApiCronService {
  constructor(config) {
    this.apiEndpoint = config.apiEndpoint;
    this.method = config.method || 'get';
    this.body = config.body || {};
    this.maxAge = config.maxAge || 24 * 60 * 60 * 1000; // 24 hours default
    this.cronSchedule = config.cronSchedule || '0 */6 * * *'; // Every 6 hours default
  }

  async runCron() {
    try {
      if(!(this.method === "post" || this.method === "get")) throw new Error("Invalid method");

      if(this.method == "post") {
        await axios.post(this.apiEndpoint, this.body);
      } else {
        await axios.get(this.apiEndpoint);
      }
    } catch (error) {
      console.error('Cron failed:', error);
    }
  }

  start() {
    // Schedule the cleanup job
    cron.schedule(this.cronSchedule, () => {
      this.runCron();
    });

    console.log(`Cron service for ${this.apiEndpoint} started`);
  }
}

module.exports = ApiCronService;