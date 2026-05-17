import { Router } from "express";
import { UserController } from "../controllers/userController";

const router = Router();

router.get("/", UserController.list);
router.get("/:id", UserController.getById);
router.delete("/:id", UserController.delete);

export default router;
