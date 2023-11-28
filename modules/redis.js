const client = require('../libs/redisClient');

module.exports = {
  setRedisValue: async (key, value) => {
    return await client.set(key, value);
  },
  getRedisValue: async (key) => {
    return await client.get(key);
  },
  delRedisValue: async (key) => {
    return await client.del(key);
  },
  setRedisHashedValue: async (key, value) => {
    const mapped = Object.entries(value).map(([key, value]) => [
      key,
      JSON.stringify(value),
    ]);

    return Promise.all(mapped.map(([k, v]) => client.hSet(key, k, v)));
  },
  getRedisHashedValue: async (key) => {
    const hashedValue = await client.hGetAll(key);

    return Object.entries(hashedValue).reduce((acc, [key, value]) => {
      acc[key] = JSON.parse(value);
      return acc;
    }, {});
  },
};
