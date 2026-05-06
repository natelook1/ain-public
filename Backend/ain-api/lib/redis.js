'use strict';

const Redis = require('ioredis');

const redis = new Redis({
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  db: 0,
  connectTimeout: 5000,
  maxRetriesPerRequest: 2,
});

redis.on('error', (err) => console.error('[Redis]', err.message));

// Register the Lua batch-fetch command used by the feed route.
// Must be called once at startup before any requests are served.
redis.defineCommand('fetchBatch', {
  numberOfKeys: 1,
  lua: `
    local ids = redis.call('ZREVRANGEBYSCORE', KEYS[1], ARGV[1], '-inf', 'WITHSCORES', 'LIMIT', 0, ARGV[2])
    local result = {}
    for i = 1, #ids, 2 do
      local id = ids[i]
      local score = ids[i+1]
      local data = redis.call('HGET', 'intel:kill:data', id)
      result[#result+1] = id
      result[#result+1] = score
      result[#result+1] = data
    end
    return result
  `,
});

module.exports = redis;
