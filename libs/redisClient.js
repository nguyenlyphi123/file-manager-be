const redis = require('redis');

let redisClient = redis.createClient({
  url: process.env.REDIS_URL,
});

redisClient.on('error', function (err) {
  console.log('*Redis Client Error: ' + err.message);
});

redisClient.on('connect', function () {
  console.log('Connected to redis instance');
});

(async () => {
  await redisClient.connect().catch((err) => {
    console.log('Redis connect error: ' + err.message);
  });
})();

module.exports = redisClient;
