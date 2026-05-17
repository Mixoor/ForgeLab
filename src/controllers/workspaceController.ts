import { Request, Response, NextFunction } from "express";
import { db } from "../database";
import { WorkspaceRole } from "../generated/enums";

export class WorkspaceController {
  public static async create(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { name, description, creatorUserId } = req.body;

      if (!name || !creatorUserId) {
        res
          .status(400)
          .json({
            error: "Validation Failed: name and creatorUserId are required.",
          });
        return;
      }

      // Execute a transaction to ensure workspace creation and membership assignment succeed together
      const result = await db.$transaction(async (tx) => {
        // Create the workspace
        const workspace = await tx.workspace.create({
          data: { name, description },
        });

        // Assign the creator as the OWNER member
        await tx.workspaceMember.create({
          data: {
            workspaceId: workspace.id,
            userId: parseInt(creatorUserId),
            role: WorkspaceRole.OWNER,
          },
        });

        return workspace;
      });

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  // 2. GET /api/workspaces -> List all workspaces
  public static async list(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const workspaces = await db.workspace.findMany({
        include: {
          _count: {
            select: { members: true, courses: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      res.json(workspaces);
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
      const workspaceId = parseInt(req?.params?.id as string);

      if (isNaN(workspaceId)) {
        res.status(400).json({ error: "Invalid Workspace ID format." });
        return;
      }

      const workspace = await db.workspace.findUnique({
        where: { id: workspaceId },
        include: {
          members: {
            include: {
              user: { select: { id: true, username: true, email: true } },
            },
          },
          courses: true,
        },
      });

      if (!workspace) {
        res.status(404).json({ error: "Workspace not found." });
        return;
      }

      res.json(workspace);
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
      const workspaceId = parseInt(req?.params?.id as string);

      if (isNaN(workspaceId)) {
        res.status(400).json({ error: "Invalid Workspace ID format." });
        return;
      }

      const exists = await db.workspace.findUnique({
        where: { id: workspaceId },
      });
      if (!exists) {
        res.status(404).json({ error: "Workspace not found." });
        return;
      }

      // Deleting the workspace triggers onDelete: Cascade for members and courses automatically
      await db.workspace.delete({
        where: { id: workspaceId },
      });

      res.json({
        success: true,
        message: `Workspace with ID [${workspaceId}] and its relations deleted successfully.`,
      });
    } catch (error) {
      next(error);
    }
  }
}
