import { Router } from "express";
import mongoose from "mongoose";
import Project from "../models/Project.js";
import Task from "../models/Task.js";
import { protect, requireRole } from "../middleware/auth.js";
import { createNotifications } from "../utils/createNotifications.js";

const router = Router();
router.use(protect);

router.get("/", async (req, res) => {
  const projects = await Project.find({ workspace: req.workspace._id }).sort({ createdAt: -1 });
  res.json({ projects });
});

router.post("/", requireRole("Administrator"), async (req, res) => {
  const { name, description = "", deadline = "", status = "In Progress" } = req.body;
  if (!name?.trim()) return res.status(400).json({ message: "Project name is required." });
  const project = await Project.create({ name, description, deadline, status, owner: req.user._id, workspace: req.workspace._id, members: req.workspace.members.map((member) => member.user) });
  req.app.get("io")?.to(`workspace:${String(req.workspace._id)}`).emit("project:changed", {
    type: "project_created",
    projectId: String(project._id),
    workspaceId: String(req.workspace._id),
  });
  await createNotifications(req, {
    recipientIds: project.members,
    type: "project_created",
    message: `${req.user.name} created project: ${project.name}`,
    projectId: project._id,
  });
  res.status(201).json({ project });
});

router.get("/:id", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "Project not found." });
  const project = await Project.findOne({ _id: req.params.id, workspace: req.workspace._id }).populate("members", "name email role");
  if (!project) return res.status(404).json({ message: "Project not found." });
  res.json({ project });
});

router.patch("/:id", requireRole("Administrator"), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "Project not found." });
  const allowed = ["name", "description", "status", "deadline"];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
  const project = await Project.findOne({ _id: req.params.id, workspace: req.workspace._id });
  if (!project) return res.status(404).json({ message: "Project not found." });
  if ("deadline" in updates && updates.deadline) {
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(updates.deadline)
      && !Number.isNaN(new Date(`${updates.deadline}T00:00:00.000Z`).getTime())
      && new Date(`${updates.deadline}T00:00:00.000Z`).toISOString().slice(0, 10) === updates.deadline;
    if (!dateOnly) return res.status(400).json({ message: "Enter a valid project deadline." });
    const laterTask = await Task.findOne({ project: project._id, dueDate: { $gt: updates.deadline, $ne: "" } }).select("title dueDate");
    if (laterTask) {
      return res.status(400).json({
        message: `Project deadline cannot be earlier than the due date of "${laterTask.title}" (${laterTask.dueDate}). Update that task's due date first.`,
      });
    }
  }
  Object.assign(project, updates);
  await project.save();
  req.app.get("io")?.to(`workspace:${String(req.workspace._id)}`).emit("project:changed", {
    type: "project_updated",
    projectId: String(project._id),
    workspaceId: String(req.workspace._id),
  });
  await createNotifications(req, {
    recipientIds: project.members,
    type: "project_updated",
    message: `${req.user.name} updated project: ${project.name}`,
    projectId: project._id,
  });
  res.json({ project });
});

router.delete("/:id", requireRole("Administrator"), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "Project not found." });
  const project = await Project.findOne({ _id: req.params.id, workspace: req.workspace._id });
  if (!project) return res.status(404).json({ message: "Project not found." });
  await createNotifications(req, {
    recipientIds: project.members,
    type: "project_deleted",
    message: `${req.user.name} deleted project: ${project.name}`,
    projectId: null,
  });
  await Task.deleteMany({ project: project._id });
  await project.deleteOne();
  req.app.get("io")?.to(`workspace:${String(req.workspace._id)}`).emit("project:changed", {
    type: "project_deleted",
    projectId: String(project._id),
    workspaceId: String(req.workspace._id),
  });
  res.json({ message: "Project and its tasks deleted." });
});

export default router;
