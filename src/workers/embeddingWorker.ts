import { Worker, Job } from "bullmq";
import { redisConnection } from "../config/redis";
import { DOCUMENT_QUEUE_NAME } from "../queues/embeddingQueue";

import { db } from "../database";

import { EmbeddingService } from "../services/embbedingService";
import { GenerationStatus } from "../generated/enums";

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

        var i = 0;
        for (const chunk of chunks) {
          if (!chunk.contentText || chunk.contentText.trim().length < 5)
            continue;

          // generate embedding vector array using the text content of the chunk
          const embeddingVector = await EmbeddingService.generateEmbedding(
            chunk.contentText,
          );

          // sleep for 200ms to avoid hitting rate limits (adjust as needed based on your API's limits)
          await new Promise((resolve) => setTimeout(resolve, 200));
          
        
          const vectorString = `[${embeddingVector.join(",")}]`;

          await db.$executeRawUnsafe(
            `UPDATE "KnowledgeChunk" SET embedding = $1::vector, "hasEmbedding" = true WHERE id = $2`,
            vectorString,
            chunk.id,
          );

          const processingProgress = Math.round(10 + ((i + 1) / chunks.length) * 90);
          await job.updateProgress(processingProgress);
          i++; // Increment the processed chunk count
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
