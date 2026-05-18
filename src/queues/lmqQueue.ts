import { Queue } from "bullmq";
import { queueRedisConnection } from "./queueConnection";

export const DOCUMENT_QUEUE_NAME = "document-lmq-queue";

export const documentLmqQueue = new Queue(DOCUMENT_QUEUE_NAME, queueRedisConnection);

interface LMQJobData {
  courseId: number;
}

export async function queueCourseIngestion(courseId: number) {
  await documentLmqQueue.add(DOCUMENT_QUEUE_NAME, { courseId } as LMQJobData, {
    jobId: `course-${courseId}`,
  });
  console.log(
    `[BullMQ] Course [${courseId}] LMQ job dispatched to queue.`,
  );
}
