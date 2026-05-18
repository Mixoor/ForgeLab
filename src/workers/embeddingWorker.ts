import { Worker, Job } from "bullmq";
import { redisConnection } from "../config/redis";
import { DOCUMENT_QUEUE_NAME } from "../queues/lmqQueue";

import { db } from "../database";

import { ParserService } from "../services/parserService";
import { EmbeddingService } from "../services/embbedingService";
import { GenerationStatus } from "../generated/enums";

export const embeddingWorker = new Worker(
  DOCUMENT_QUEUE_NAME,
  async (job: Job) => {
    const { courseId } = job.data;
    console.log(
      `[Worker] Running layout-aware text extraction for Course: ${courseId}`,
    );

    await db.knowledgeSource.updateMany({
      where: { courseId: courseId },
      data: { vectorIndexStatus: GenerationStatus.PROCESSING },
    });

    try {
      const courseSources = await db.knowledgeSource.findMany({
        where: { courseId: courseId },
      });

      for (const source of courseSources) {
        console.log(
          `[Worker] Querying Unstructured API for file: ${source.title}`,
        );

        const elements = await ParserService.parseLayout(source.filePath);

        const createdChunkIds: string[] = [];

        for (const element of elements) {
          if (!element.text || element.text.trim().length < 5) continue;

          var knowledgeChunk = await db.knowledgeChunk.create({
            data: {
              sourceId: source.id,
              pageNumber: element.pageNumber,
              category: element.type, // Stores "Table", "Title", "ListItem" , "CodeBlock"
              contentText: element.text,
              hasEmbedding: false,
            },
          });
          // Track the newly created chunk IDs for subsequent embedding generation step
          createdChunkIds.push(knowledgeChunk.id);
        }

        console.log(
          `[Worker] Step 2: Generating vector embeddings for ${createdChunkIds.length} text chunks...`,
        );

        // Iterate through the newly created chunks and update them with embeddings
        for (const chunkId of createdChunkIds) {
          const chunk = await db.knowledgeChunk.findUnique({
            where: { id: chunkId },
          });
          if (!chunk) continue;

          // generate embedding vector array using the text content of the chunk
          const embeddingVector = await EmbeddingService.generateEmbedding(
            chunk.contentText,
          );

          const vectorString = `[${embeddingVector.join(",")}]`;

          await db.$executeRawUnsafe(
            `UPDATE "KnowledgeChunk" SET embedding = $1::vector, "hasEmbedding" = true WHERE id = $2`,
            vectorString,
            chunkId,
          );
        }

        await db.knowledgeSource.update({
          where: { id: source.id },
          data: { vectorIndexStatus: GenerationStatus.INDEXED },
        });

        console.log(`[Worker] Layout extraction complete for: ${source.title}`);
      }

      console.log(
        `[Worker] Success! All structured knowledge chunks committed cleanly.`,
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
