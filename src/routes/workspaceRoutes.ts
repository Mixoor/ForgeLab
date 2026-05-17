import { Router } from "express";
import { WorkspaceController } from "../controllers/workspaceController";

const router = Router();

router.post("/", WorkspaceController.create);
router.get("/", WorkspaceController.list);
router.get("/:id", WorkspaceController.getById);
router.delete("/:id", WorkspaceController.delete);

export default router;
