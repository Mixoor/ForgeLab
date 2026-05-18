import { Queue } from "bullmq";
import { queueRedisConnection } from "./queueConnection";

export const DOCUMENT_QUEUE_NAME = "document-embedding-queue";


export const documentEmbeddingQueue = new Queue(DOCUMENT_QUEUE_NAME, queueRedisConnection);

interface EmbeddingJobData {
  courseId: number;
}

export async function queueCourseEmbedding(courseId: number) {
  await documentEmbeddingQueue.add(
    DOCUMENT_QUEUE_NAME,
    { courseId } as EmbeddingJobData,
    { jobId: `course-${courseId}` },
  );
  console.log(
    `[BullMQ] Course [${courseId}] embedding job dispatched to queue.`,
  );
}
