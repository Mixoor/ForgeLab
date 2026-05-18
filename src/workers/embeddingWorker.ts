import { Worker, Job } from "bullmq";
import { redisConnection } from "../config/redis";
import { DOCUMENT_QUEUE_NAME } from "../queues/embeddingQueue";

import { db } from "../database";

import { EmbeddingService } from "../services/embbedingService";
import { GenerationStatus } from "../generated/enums";

const BATCH_SIZE = 100;

export const embeddingWorker = new Worker(
  DOCUMENT_QUEUE_NAME,
  async (job: Job) => {
    const { courseId } = job.data;
    console.log(
      `[Worker] Running embedding generation for Course: ${courseId}`,
    );


    try {
      const courseSources = await db.knowledgeSource.findMany({
        where: { courseId: courseId },
      });

      for (const source of courseSources) {
        console.log(
          `[Worker] Querying Embedding API for file: ${source.title}`,
        );

        var chunks = await db.knowledgeChunk.findMany({
          where: { sourceId: source.id, hasEmbedding: false },
        });

       const totalChunks = chunks.length;
 
        var i = 0;
        for (let i = 0; i < totalChunks; i += BATCH_SIZE) {
          const currentBatch = chunks.slice(i, i + BATCH_SIZE);

          // generate embedding vector array using the text content of the chunk
          const embeddings = await EmbeddingService.generateEmbedding(
            currentBatch.map((c) => c.contentText),
          );

          if (!embeddings || embeddings.length !== chunks.length) {
            throw new Error(
              "Mismatch or empty vector metrics returned from the API batch slot.",
            );
          }

          await db.$transaction(
            chunks.map((chunk, index) => {
              const vectorString = `[${embeddings[index]?.values?.join(",")}]`;
              return db.$executeRawUnsafe(
                `UPDATE knowledge_chunks SET embedding = $1::vector, "hasEmbedding" = true WHERE id = $2`,
                vectorString,
                chunk.id,
              );
            }),
          );

          const progress = Math.min(
            100,
            Math.round(((i + BATCH_SIZE) / totalChunks) * 100),
          );
          await job.updateProgress(progress);

          await new Promise((resolve) => setTimeout(resolve, 1500)); // Increment the processed chunk count
        }

        await db.knowledgeSource.update({
          where: { id: source.id },
          data: { vectorIndexStatus: GenerationStatus.INDEXED },
        });

        console.log(`[Worker] Embedding generation complete for: ${source.title}`);
      }
      
      console.log(
        `[Worker] Success! All embedded knowledge chunks committed cleanly.`,
      );
    } catch (error: any) {
      console.error(`[Worker Failed]:`, error.message);
      await db.knowledgeSource.updateMany({
        where: { courseId: courseId },
        data: { vectorIndexStatus: GenerationStatus.FAILED },
      });
      throw error;
    }
  },
  { connection: redisConnection, concurrency: 1 },
);
