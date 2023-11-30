const client = require('../libs/redisClient');

const exTime = parseInt(new Date().setHours(23, 59, 59, 999) / 1000);

class RedisClient {
  constructor() {
    this.client = client;
  }

  async setValue(key, value) {
    return await this.client.set(key, value, 'EX', exTime);
  }

  async getValue(key) {
    return await this.client.get(key);
  }

  async delValue(key) {
    return await this.client.del(key);
  }

  async delWithKeyMatchPrefix(prefix) {
    const keysToDelete = await this.client.keys(`${prefix}:*`);

    if (!keysToDelete.length) return;

    return this.client.unlink(keysToDelete);
  }
}

module.exports = new RedisClient();
