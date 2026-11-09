import jwt from "jsonwebtoken";
import User from "./models/User.js";
import Workspace from "./models/Workspace.js";

export function configureSocket(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Authentication required."));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select("name activeWorkspace");
      if (!user || !user.activeWorkspace) {
        return next(new Error("A valid active workspace is required."));
      }

      const workspace = await Workspace.findOne({
        _id: user.activeWorkspace,
        "members.user": user._id,
      }).select("_id");

      if (!workspace) return next(new Error("Workspace access denied."));

      // Clients cannot choose room IDs. Membership is verified from the database.
      socket.data.userId = String(user._id);
      socket.data.userName = user.name;
      socket.data.workspaceId = String(workspace._id);
      next();
    } catch {
      next(new Error("Invalid or expired authentication token."));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`workspace:${socket.data.workspaceId}`);
    socket.join(`user:${socket.data.userId}`);
    socket.join(`user:${socket.data.userId}:workspace:${socket.data.workspaceId}`);
  });
}
