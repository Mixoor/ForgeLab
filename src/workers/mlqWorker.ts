import { Worker, Job } from "bullmq";
import { redisConnection } from "../config/redis";
import { DOCUMENT_QUEUE_NAME } from "../queues/lmqQueue";

import { db } from "../database";

import { GenerationStatus } from "../generated/enums";
import { DiscoveryService } from "../services/discoveryService";
import { ContentGenerationService } from "../services/contentGenerationService";

export const lmqWorker = new Worker(
  DOCUMENT_QUEUE_NAME,
  async (job: Job) => {
    const { courseId } = job.data;
    console.log(
      `[Worker] Initiating Course Blueprint Auto-Discovery : ${courseId}`,
    );

    var sources = await db.knowledgeSource.findMany({
      where: { courseId: courseId },
    });

    try{
      for(const source of sources){
        const title = source.title || `Source ${source.id}`;
        const sourceId = source.id;

          const courseBlueprintId = await DiscoveryService.generateInitialBlueprint(
            sourceId,
            title || "Untitled Course",
          );

          var modules = await db.module.findMany({
            where: { courseId: courseId, blueprintId: courseBlueprintId },
            select: { id: true, title: true, orderIndex: true },
            orderBy: { orderIndex: "asc" },
          });

          for(const module of modules){
            await ContentGenerationService.generateAnyDocumentContent(
              module.id,
              module.title,
              module.orderIndex
            )
          }
      }

      console.log(
        `[Worker] Success! All course blueprints generated cleanly. Blueprint IDs: ${sources.map(s => s.id).join(", ")} `,
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
