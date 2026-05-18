import { Request, Response, NextFunction } from "express";
import { db } from "../database";

export class StatusController {
  public static async getCourseIngestionProgress(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const courseId = parseInt(req.params?.courseId as string);

      if (isNaN(courseId)) {
        res
          .status(400)
          .json({ error: "Invalid Course ID parameter configuration." });
        return;
      }

      const sources = await db.knowledgeSource.findMany({
        where: { courseId },
        include: {
          _count: {
            select: { chunks: true },
          },
        },
      });

      const embeddedCount = await db.knowledgeChunk.count({
        where: {
          source: { courseId },
          hasEmbedding: true,
        },
      });

      const totalChunks = sources.reduce(
        (acc, source) => acc + source._count.chunks,
        0,
      );

      // Calculate global percentage safety window
      let percentage = 0;
      if (totalChunks > 0) {
        percentage = Math.round((embeddedCount / totalChunks) * 100);
      }

      // Determine global status state flag
      let globalStatus = "PENDING";
      if (sources.some((s) => s.vectorIndexStatus === "FAILED"))
        globalStatus = "FAILED";
      else if (sources.some((s) => s.vectorIndexStatus === "PROCESSING"))
        globalStatus = "PROCESSING";
      else if (sources.every((s) => s.vectorIndexStatus === "INDEXED"))
        globalStatus = "INDEXED";

      res.status(200).json({
        courseId,
        status: globalStatus,
        progressPercentage: percentage,
        meta: {
          totalChunks,
          embeddedChunks: embeddedCount,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
