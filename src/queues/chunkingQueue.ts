import { Queue } from "bullmq";
import { queueRedisConnection } from "./queueConnection";

export const DOCUMENT_QUEUE_NAME = "document-chunking-queue";

export const documentChunkingQueue = new Queue(
  DOCUMENT_QUEUE_NAME,
  queueRedisConnection,
);

interface ChunkingJobData {
  courseId: number;
}

export async function queueCourseChunking(courseId: number) {
  await documentChunkingQueue.add(
    DOCUMENT_QUEUE_NAME,
    { courseId } as ChunkingJobData,
    { jobId: `course-${courseId}` },
  );
  console.log(
    `[BullMQ] Course [${courseId}] chunking job dispatched to queue.`,
  );
}
