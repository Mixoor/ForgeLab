import { redisConnection } from "../config/redis";

const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;

const queueRedisConnection = {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: MAX_RETRIES, // Retry failed jobs up to 3 times
    backoff: {
      type: "exponential",
      delay: RETRY_DELAY,
    },
    removeOnComplete: { age: 3600 }, // Clean up completed logs after 1 hour
    removeOnFail: { age: 86400 }, // Keep failure logs for 24 hours for debugging
  },
};

export { queueRedisConnection };
