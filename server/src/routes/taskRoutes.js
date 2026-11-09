import { Router } from "express";
import mongoose from "mongoose";
import Task from "../models/Task.js";
import Project from "../models/Project.js";
import { protect, requireRole } from "../middleware/auth.js";
import { publishTaskActivity } from "../utils/publishTaskActivity.js";

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
  const tasks = await Task.find(filter)
    .populate("assignee", "name email")
    .populate("comments.author", "name")
    .sort({ createdAt: -1 });
  res.json({ tasks });
});

router.post("/", async (req, res) => {
  const {
    projectId,
    title,
    description = "",
    status = "To Do",
    priority = "Medium",
    dueDate = "",
    assigneeId = null,
  } = req.body;
  const project = await workspaceProject(projectId, req.workspace._id);
  if (!project) return res.status(404).json({ message: "Project not found." });
  if (typeof title !== "string" || !title.trim()) {
    return res.status(400).json({ message: "Task title is required." });
  }

  // Members can create tasks, but those tasks are assigned to themselves.
  const targetAssigneeId = req.membership.role === "Administrator"
    ? assigneeId
    : req.user._id;
  if (targetAssigneeId && !mongoose.isValidObjectId(targetAssigneeId)) {
    return res.status(400).json({ message: "Invalid task assignee." });
  }
  if (targetAssigneeId && !req.workspace.members.some(
    (member) => String(member.user) === String(targetAssigneeId),
  )) {
    return res.status(400).json({ message: "Assignee must be a member of this workspace." });
  }

  const task = await Task.create({
    project: project._id,
    title: title.trim(),
    description,
    status,
    priority,
    dueDate,
    assignee: targetAssigneeId || null,
    createdBy: req.user._id,
  });
  await task.populate("assignee", "name email");
  await publishTaskActivity(req, {
    type: "task_created",
    taskId: task._id,
    message: `${req.user.name} created task: ${task.title}`,
  });
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
  const allowed = ["title", "description", "status", "priority", "dueDate", "assigneeId"];
  if ("assigneeId" in req.body) {
    const { assigneeId } = req.body;
    if (assigneeId && !mongoose.isValidObjectId(assigneeId)) {
      return res.status(400).json({ message: "Invalid task assignee." });
    }
    if (assigneeId && !req.workspace.members.some(
      (member) => String(member.user) === String(assigneeId),
    )) {
      return res.status(400).json({ message: "Assignee must be a member of this workspace." });
    }
    task.assignee = assigneeId || null;
  }
  for (const key of allowed) {
    if (key !== "assigneeId" && key in req.body) task[key] = req.body[key];
  }
  await task.save();
  await task.populate("assignee", "name email");
  await task.populate("comments.author", "name");
  await publishTaskActivity(req, { type: "task_updated", taskId: task._id, message: `${req.user.name} updated task: ${task.title}` });
  res.json({ task });
});

router.delete("/:id", requireRole("Administrator"), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "Task not found." });
  const task = await Task.findById(req.params.id).populate("project", "workspace");
  if (!task || String(task.project?.workspace) !== String(req.workspace._id)) return res.status(404).json({ message: "Task not found." });
  const deletedTaskId = task._id;
  const deletedTaskTitle = task.title;
  await task.deleteOne();
  await publishTaskActivity(req, { type: "task_deleted", taskId: deletedTaskId, message: `${req.user.name} deleted task: ${deletedTaskTitle}` });
  res.json({ message: "Task deleted." });
});

router.post("/:id/comments", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "Task not found." });
  const task = await Task.findById(req.params.id).populate("project", "workspace");
  if (!task || String(task.project?.workspace) !== String(req.workspace._id)) return res.status(404).json({ message: "Task not found." });
  if (!req.body.text?.trim()) return res.status(400).json({ message: "Comment cannot be empty." });
  task.comments.push({ author: req.user._id, text: req.body.text.trim() });
  await task.save();
  await task.populate("assignee", "name email");
  await task.populate("comments.author", "name");
  await publishTaskActivity(req, { type: "task_commented", taskId: task._id, message: `${req.user.name} commented on task: ${task.title}` });
  res.status(201).json({ comments: task.comments });
});

export default router;
