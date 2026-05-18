import { Router } from "express";
import { CourseController } from "../controllers/courseController";
import { StatusController } from "../controllers/statusController";


const router = Router();

router.post("/", CourseController.createCourseWithSources);

router.get(
  "/:courseId/ingestion-progress",
  StatusController.getCourseIngestionProgress,
);

export default router;
