import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import Workspace from "../models/Workspace.js";
import Project from "../models/Project.js";
import User from "../models/User.js";
import dns from "node:dns";

dns.setServers(["1.1.1.1", "8.8.8.8"]);
const initialsFor = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

async function migrate() {
  await connectDB();

  // Match the workspace provisioning behavior in auth middleware for older projects
  // that predate workspace support and still have no workspace reference.
  let projectsAttached = 0;
  const users = await User.find({}).select("_id activeWorkspace");
  for (const user of users) {
    let workspace = user.activeWorkspace
      ? await Workspace.findOne({
          _id: user.activeWorkspace,
          "members.user": user._id,
        }).select("_id")
      : null;
    if (!workspace) {
      workspace = await Workspace.findOne({ "members.user": user._id }).select(
        "_id",
      );
    }
    if (!workspace) continue;
    const result = await Project.updateMany(
      {
        owner: user._id,
        $or: [{ workspace: null }, { workspace: { $exists: false } }],
      },
      { $set: { workspace: workspace._id } },
    );
    projectsAttached += result.modifiedCount || 0;
  }

  const workspaces = await Workspace.find({}).populate("members.user", "name");
  let migrated = 0;
  let unassigned = 0;

  for (const workspace of workspaces) {
    const projects = await Project.find({ workspace: workspace._id })
      .select("_id")
      .lean();
    const projectIds = projects.map((project) => project._id);
    if (!projectIds.length) continue;

    const legacyTasks = await mongoose.connection
      .collection("tasks")
      .find({ project: { $in: projectIds }, assignee: { $type: "string" } })
      .toArray();

    const memberByInitials = new Map();
    for (const member of workspace.members) {
      if (!member.user?._id || !member.user?.name) continue;
      const initials = initialsFor(member.user.name);
      if (!memberByInitials.has(initials)) memberByInitials.set(initials, []);
      memberByInitials.get(initials).push(member.user._id);
    }

    for (const task of legacyTasks) {
      const matches =
        memberByInitials.get(String(task.assignee || "").toUpperCase()) || [];
      const assignee = matches.length === 1 ? matches[0] : null;
      await mongoose.connection
        .collection("tasks")
        .updateOne(
          { _id: task._id, assignee: task.assignee },
          { $set: { assignee } },
        );
      if (assignee) migrated += 1;
      else unassigned += 1;
    }
  }

  const remainingLegacy = await mongoose.connection
    .collection("tasks")
    .countDocuments({ assignee: { $type: "string" } });
  const existingReferences = await mongoose.connection
    .collection("tasks")
    .countDocuments({ assignee: { $type: "objectId" } });

  console.log("Task assignee migration complete.");
  console.log(
    `Legacy projects attached to their owner's workspace: ${projectsAttached}`,
  );
  console.log(`Mapped to a unique workspace member: ${migrated}`);
  console.log(`Set to Unassigned (no unique initials match): ${unassigned}`);
  console.log(`Existing ObjectId references: ${existingReferences}`);
  if (remainingLegacy) {
    console.warn(
      `${remainingLegacy} legacy string assignees remain. They may belong to projects without a workspace.`,
    );
  }
}

migrate()
  .catch((error) => {
    console.error("Task assignee migration failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
