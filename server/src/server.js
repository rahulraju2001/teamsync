import dns from "node:dns";
import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { connectDB } from "./config/db.js";
import { configureSocket } from "./socket.js";
import authRoutes from "./routes/authRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import workspaceRoutes from "./routes/workspaceRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import { startOverdueNotificationScheduler } from "./utils/overdueNotificationScheduler.js";

dns.setServers(["1.1.1.1", "8.8.8.8"]);

const app = express();
const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: clientUrl, methods: ["GET", "POST", "PATCH", "DELETE"] },
});

configureSocket(io);
app.set("io", io);
app.use(cors({ origin: clientUrl }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "teamsync-api" }));
app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/workspace", workspaceRoutes);
app.use("/api/notifications", notificationRoutes);

app.use((error, _req, res, next) => {
  // Invalid JSON is rejected by express.json before it reaches a route.
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Request body contains invalid JSON." });
  }
  if (error.type === "entity.too.large") {
    return res.status(413).json({ message: "Request body is too large." });
  }

  // Treat database validation/casting failures as invalid client input rather
  // than unexpected server failures.
  if (error.name === "ValidationError") {
    const messages = Object.values(error.errors || {}).map((item) => item.message);
    return res.status(400).json({ message: messages.join(" ") || "Submitted data is invalid." });
  }
  if (error.name === "CastError") {
    return res.status(400).json({ message: `Invalid value for ${error.path || "a submitted field"}.` });
  }
  if (error.code === 11000) {
    return res.status(409).json({ message: "A record with that value already exists." });
  }

  console.error(error);
  const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 600
    ? error.status
    : 500;
  const message = status === 500 && process.env.NODE_ENV !== "development"
    ? "Internal server error."
    : (error.message || "Internal server error.");
  return res.status(status).json({ message });
});

const port = process.env.PORT || 5000;
connectDB()
  .then(() => {
    startOverdueNotificationScheduler(io);
    httpServer.listen(port, () => console.log(`API and Socket.IO listening on http://localhost:${port}`));
  })
  .catch((error) => {
    console.error(`Server startup failed: ${error.message}`);
    process.exit(1);
  });
