import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Workspace from "../models/Workspace.js";
import Project from "../models/Project.js";

async function ensureWorkspace(user) {
  let workspace = null;
  if (user.activeWorkspace) {
    workspace = await Workspace.findOne({ _id: user.activeWorkspace, "members.user": user._id });
  }
  if (!workspace) workspace = await Workspace.findOne({ "members.user": user._id });
  if (!workspace) {
    workspace = await Workspace.create({
      name: `${user.name}'s Workspace`,
      owner: user._id,
      members: [{ user: user._id, role: "Administrator" }],
    });
  }

  // Attach projects created before workspace support to this user's workspace.
  await Project.updateMany(
    { owner: user._id, $or: [{ workspace: null }, { workspace: { $exists: false } }] },
    { $set: { workspace: workspace._id } },
  );

  const membership = workspace.members.find(
    (member) => String(member.user) === String(user._id),
  );
  const nextRole = membership?.role || "Administrator";
  if (
    String(user.activeWorkspace || "") !== String(workspace._id) ||
    user.role !== nextRole
  ) {
    user.activeWorkspace = workspace._id;
    user.role = nextRole;
    await user.save({ validateBeforeSave: false });
  }
  return workspace;
}

export async function protect(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Authentication required." });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ message: "Account no longer exists." });
    const workspace = await ensureWorkspace(user);
    const membership = workspace.members.find((member) => String(member.user) === String(user._id));
    if (!membership) return res.status(403).json({ message: "You are not a member of this workspace." });
    req.user = user;
    req.workspace = workspace;
    req.membership = membership;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Invalid or expired token." });
    }
    next(error);
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.membership || !roles.includes(req.membership.role)) {
      return res.status(403).json({ message: "You do not have permission to perform this action." });
    }
    next();
  };
}
