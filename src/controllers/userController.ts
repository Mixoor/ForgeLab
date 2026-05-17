import { Request, Response, NextFunction } from "express";
import { db } from "../database";

export class UserController {
  // 2. GET /api/users -> List all active application profiles
  public static async list(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const users = await db.user.findMany({
        select: {
          id: true,
          email: true,
          username: true,
          _count: { select: { workspaces: true, courses: true } },
        },
        orderBy: { id: "asc" },
      });
      res.json(users);
    } catch (error) {
      next(error);
    }
  }

  // 3. GET /api/users/:id -> Fetch user with their workspace mapping topologies
  public static async getById(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = parseInt(req?.params?.id as string);

      if (isNaN(userId)) {
        res
          .status(400)
          .json({ error: "Invalid User ID format configuration." });
        return;
      }

      const user = await db.user.findUnique({
        where: { id: userId },
        include: {
          workspaces: {
            include: {
              workspace: {
                select: { id: true, name: true, description: true },
              },
            },
          },
          courses: {
            select: { id: true, title: true, difficultyLevel: true },
          },
        },
      });

      if (!user) {
        res.status(404).json({ error: "User target reference not found." });
        return;
      }

      res.json(user);
    } catch (error) {
      next(error);
    }
  }

  // 4. DELETE /api/users/:id -> Complete profile deletion
  public static async delete(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = parseInt(req?.params?.id as string);

      if (isNaN(userId)) {
        res
          .status(400)
          .json({ error: "Invalid User ID format configuration." });
        return;
      }

      const exists = await db.user.findUnique({ where: { id: userId } });
      if (!exists) {
        res
          .status(404)
          .json({ error: "User entity targeting parameter not found." });
        return;
      }

      // Cascade parameters cleanly drop workspace_members links automatically.
      // Note: Because Course -> User doesn't have cascade delete configured in your schema,
      // we'll run this inside a transaction to prevent foreign key constraint violations.
      await db.$transaction(async (tx) => {
        // Disassociate or drop courses authored by this user first
        await tx.course.deleteMany({ where: { authorId: userId } });

        // Remove the user node
        await tx.user.delete({ where: { id: userId } });
      });

      res.json({
        success: true,
        message: `User record with ID [${userId}] and author credentials dropped successfully.`,
      });
    } catch (error) {
      next(error);
    }
  }
}
