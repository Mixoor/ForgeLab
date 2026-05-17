import { Express } from "express";

import { serverAdapter } from "../config/bullBoard";

import workspaceRoutes from "./workspaceRoutes";
import userRoutes from "./userRoutes";
import authRoutes from "./authRoutes";
import courseRoutes from "./courseRoutes";

var setupRoutes = function (app: Express) {
  app.use("/api/workspaces", workspaceRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/courses", courseRoutes);

  // Bull Board UI for monitoring queues
  app.use("/admin/queues", serverAdapter.getRouter());

};

export default setupRoutes;
