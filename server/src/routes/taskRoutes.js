import { Router } from "express";
import mongoose from "mongoose";
import Task from "../models/Task.js";
import Project from "../models/Project.js";
import { protect, requireRole } from "../middleware/auth.js";

const router = Router();
router.use(protect);

async function workspaceProject(projectId, workspaceId) {
  if (!mongoose.isValidObjectId(projectId)) return null;
  return Project.findOne({ _id: projectId, workspace: workspaceId }).select("_id");
}

router.get("/", async (req, res) => {
  const filter = {};
  if (req.query.projectId) {
    const project = await workspaceProject(req.query.projectId, req.workspace._id);
    if (!project) return res.status(404).json({ message: "Project not found." });
    filter.project = project._id;
  } else {
    const projects = await Project.find({ workspace: req.workspace._id }).select("_id");
    filter.project = { $in: projects.map((project) => project._id) };
  }
  const tasks = await Task.find(filter).populate("comments.author", "name").sort({ createdAt: -1 });
  res.json({ tasks });
});

router.post("/", async (req, res) => {
  const { projectId, title, description = "", status = "To Do", priority = "Medium", dueDate = "", assignee = "R" } = req.body;
  const project = await workspaceProject(projectId, req.workspace._id);
  if (!project) return res.status(404).json({ message: "Project not found." });
  if (!title?.trim()) return res.status(400).json({ message: "Task title is required." });
  const memberInitials = req.user.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const safeAssignee = req.membership.role === "Administrator" ? assignee : memberInitials;
  const task = await Task.create({ project: project._id, title, description, status, priority, dueDate, assignee: safeAssignee, createdBy: req.user._id });
  res.status(201).json({ task });
});

router.patch("/:id", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "Task not found." });
  const task = await Task.findById(req.params.id).populate("project", "workspace");
  if (!task || String(task.project?.workspace) !== String(req.workspace._id)) return res.status(404).json({ message: "Task not found." });

  if (req.membership.role === "Member") {
    // Members may update task status, but cannot change task ownership, content, priority or assignment.
    if (Object.keys(req.body).some((key) => key !== "status")) {
      return res.status(403).json({ message: "Members can only update task status. Ask an Administrator to edit other task details." });
    }
  }
  const allowed = ["title", "description", "status", "priority", "dueDate", "assignee"];
  for (const key of allowed) if (key in req.body) task[key] = req.body[key];
  await task.save();
  await task.populate("comments.author", "name");
  res.json({ task });
});

router.delete("/:id", requireRole("Administrator"), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "Task not found." });
  const task = await Task.findById(req.params.id).populate("project", "workspace");
  if (!task || String(task.project?.workspace) !== String(req.workspace._id)) return res.status(404).json({ message: "Task not found." });
  await task.deleteOne();
  res.json({ message: "Task deleted." });
});

router.post("/:id/comments", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "Task not found." });
  const task = await Task.findById(req.params.id).populate("project", "workspace");
  if (!task || String(task.project?.workspace) !== String(req.workspace._id)) return res.status(404).json({ message: "Task not found." });
  if (!req.body.text?.trim()) return res.status(400).json({ message: "Comment cannot be empty." });
  task.comments.push({ author: req.user._id, text: req.body.text.trim() });
  await task.save();
  await task.populate("comments.author", "name");
  res.status(201).json({ comments: task.comments });
});

export default router;
