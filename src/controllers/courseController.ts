import { Request, Response, NextFunction } from "express";
import { db } from "../database";
import { unlinkFile } from "../config/multer";
import { queueCourseIngestion } from "../queues/documentQueue";

export class CourseController {
  public static async createCourseWithSources(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const {
        title,
        customInstructions,
        strategy,
        performanceMetric,
        difficultyLevel,
        authorId,
        workspaceId,
      } = req.body;
      const files = req.files as Express.Multer.File[];

      // 1. Basic validation check parameters
      if (!title || !authorId || !workspaceId) {
        res.status(400).json({
          error:
            "Validation Error: title, authorId, and workspaceId are required fields.",
        });
        return;
      }

      if (!files || files.length === 0) {
        res.status(400).json({
          error:
            "Validation Error: At least one source text/PDF file documentation layout must be uploaded.",
        });
        return;
      }

      // 2. Wrap database mutations in a clean transactional safety context
      const newCourseStructure = await db.$transaction(async (tx) => {
        // A. Insert the main Course profile node
        const course = await tx.course.create({
          data: {
            title,
            customInstructions,
            strategy: strategy || "VECTOR_SEARCH",
            performanceMetric: performanceMetric || "FAST",
            difficultyLevel: difficultyLevel || "MEDIUM",
            authorId: parseInt(authorId),
            workspaceId: parseInt(workspaceId),
          },
        });

        // B. Map uploaded file entities to structural database relational lines
        const sourceCreationPromises = files.map((file) => {
          return tx.knowledgeSource.create({
            data: {
              courseId: course.id,
              title: file.originalname,
              filePath: file.path, // Tracks exact absolute path location on server node
              vectorIndexStatus: "PENDING",
            },
          });
        });

        await Promise.all(sourceCreationPromises);

        // Fetch completed configuration payload to return to client pipeline
        return tx.course.findUnique({
          where: { id: course.id },
          include: { knowledgeSources: true },
        });
      });

      // Fire and forget: Offload document parsing to our background architecture
      if (newCourseStructure) {
        await queueCourseIngestion(newCourseStructure.id);
      }
      
      res.status(201).json(newCourseStructure);
    } catch (error) {
      next(error);
    }
  }

  public static async getById(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const courseId = parseInt(req?.params?.id as string);

      if (isNaN(courseId)) {
        res
          .status(400)
          .json({ error: "Invalid Course ID format configuration." });
        return;
      }

      const course = await db.course.findUnique({
        where: { id: courseId },
        include: {
          knowledgeSources: true,
          workspace: {
            select: { id: true, name: true, description: true },
          },
        },
      });
      

      if (!course) {
        res.status(404).json({ error: "Course target reference not found." });
        return;
      }

      res.json(course);
    } catch (error) {
      next(error);
    }
  }

  public static async delete(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const courseId = parseInt(req?.params?.id as string);

      if (isNaN(courseId)) {
        res
          .status(400)
          .json({ error: "Invalid Course ID format configuration." });
        return;
      }

      const exists = await db.course.findUnique({ where: { id: courseId } });
      if (!exists) {
        res
          .status(404)
          .json({ error: "Course entity targeting parameter not found." });
        return;
      }

      await db.$transaction(async (tx) => {
        var files = await tx.knowledgeSource.findMany({ where: { courseId } });
        for (const sourceFile of files) {
          await unlinkFile(sourceFile.filePath); // Remove source file from server storage
        }
        await tx.knowledgeSource.deleteMany({ where: { courseId } });

        await tx.course.delete({ where: { id: courseId } });
      });

      res.json({
        success: true,
        message: `Course record with ID [${courseId}] and associated knowledge sources dropped successfully.`,
      });
    } catch (error) {
      next(error);
    }
  }
}
