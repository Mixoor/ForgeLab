// Import the document worker to ensure it starts when the app runs
import "./workers/documentWorker";

import dotenv from "dotenv";
import "dotenv/config";

import cors from "cors";
import express from "express";

// routes setup
import setupRoutes from "./routes";

// Load the variables from .env into process.env
dotenv.config();

// configure the express app
const app = express();
app.use(cors());
app.use(express.json());

// setup the routes
setupRoutes(app);

const PORT = process.env.PORT || 3000;

// Global Error Handler boundary
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    console.error("Runtime Exception:", err.message);
    res.status(500).json({ error: "Internal Server Error Error Loop" });
  },
);

app.listen(PORT, () => {
  console.log(`🚀 Skill Anvil Core API running on http://localhost:${PORT}`);
  console.log(
    `📊 Bull Board Queue Monitor available at http://localhost:${PORT}/admin/queues`,
  );
});
