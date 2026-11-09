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
  void next;
  console.error(error);
  res.status(error.status || 500).json({ message: error.message || "Internal server error." });
});

const port = process.env.PORT || 5000;
connectDB()
  .then(() => httpServer.listen(port, () => console.log(`API and Socket.IO listening on http://localhost:${port}`)))
  .catch((error) => {
    console.error(`Server startup failed: ${error.message}`);
    process.exit(1);
  });
