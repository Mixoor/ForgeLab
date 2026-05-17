import { Router } from "express";
import { CourseController } from "../controllers/courseController";
import { upload } from "../config/multer";

const router = Router();

router.post(
  "/",
  upload.array("files", 10),
  CourseController.createCourseWithSources,
);
router.get("/:id", CourseController.getById);
router.delete("/:id", CourseController.delete);

export default router;
