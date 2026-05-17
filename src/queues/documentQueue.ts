import { Queue } from "bullmq";
import { redisConnection } from "../config/redis";

export const DOCUMENT_QUEUE_NAME = "document-ingestion-queue";

const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;

export const documentQueue = new Queue(DOCUMENT_QUEUE_NAME, {
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
});

interface IngestionJobData {
  courseId: number;
}

export async function queueCourseIngestion(courseId: number) {
  await documentQueue.add(
    "process-course-docs",
    { courseId } as IngestionJobData,
    { jobId: `course-${courseId}` }, 
  );
  console.log(
    `[BullMQ] Course [${courseId}] ingestion job dispatched to queue.`,
  );
}
