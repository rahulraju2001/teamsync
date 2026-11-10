import { Router } from "express";
import mongoose from "mongoose";
import Task from "../models/Task.js";
import Project from "../models/Project.js";
import { protect, requireRole } from "../middleware/auth.js";
import { publishTaskActivity } from "../utils/publishTaskActivity.js";
import { createNotifications } from "../utils/createNotifications.js";
import { getDateOnlyInTimeZone, isDateOnly, validateBody, validateParams } from "../middleware/validate.js";

const router = Router();
router.use(protect);

const taskFields = ["title", "description", "status", "priority", "dueDate", "assigneeId"];
const validStatuses = ["To Do", "In Progress", "Completed"];
const taskCreateFields = {
  projectId: { type: "objectId", required: true, label: "Project" },
  title: { type: "string", required: true, minLength: 1, maxLength: 100, label: "Task title" },
  description: { type: "string", maxLength: 2000, label: "Task description" },
  status: { type: "string", enum: validStatuses, label: "Task status" },
  priority: { type: "string", enum: ["Low", "Medium", "High"], label: "Task priority" },
  dueDate: { type: "string", required: true, minLength: 10, maxLength: 10, dateOnly: true, label: "Task due date" },
  assigneeId: { type: "objectId", nullable: true, allowEmpty: true, label: "Task assignee" },
};
const taskUpdateFields = Object.fromEntries(
  Object.entries(taskCreateFields).filter(([key]) => key !== "projectId").map(([key, rule]) => [key, { ...rule, required: false }]),
);

async function workspaceProject(projectId, workspaceId) {
  if (!mongoose.isValidObjectId(projectId)) return null;
  return Project.findOne({ _id: projectId, workspace: workspaceId }).select("_id owner name deadline");
}

function isWorkspaceMember(workspace, userId) {
  return workspace.members.some((member) => String(member.user?._id || member.user) === String(userId));
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
  // All workspace members can view every task in their workspace.
  const tasks = await Task.find(filter)
    .populate("assignee", "name email")
    .populate("comments.author", "name")
    .sort({ createdAt: -1 });
  res.json({ tasks });
});

router.post("/", requireRole("Administrator"), validateBody(taskCreateFields), async (req, res) => {
  const {
    projectId,
    title,
    description = "",
    status = "To Do",
    priority = "Medium",
    dueDate,
    assigneeId = null,
  } = req.body;
  const project = await workspaceProject(projectId, req.workspace._id);
  if (!project) return res.status(404).json({ message: "Project not found." });
  if (typeof title !== "string" || !title.trim()) {
    return res.status(400).json({ message: "Task title is required." });
  }
  if (!validStatuses.includes(status)) return res.status(400).json({ message: "Invalid task status." });
  if (!isDateOnly(dueDate)) return res.status(400).json({ message: "A valid task due date is required." });
  if (dueDate < getDateOnlyInTimeZone()) {
    return res.status(400).json({ message: "Task due date cannot be earlier than today." });
  }
  if (project.deadline && dueDate > project.deadline) {
    return res.status(400).json({ message: "Task due date cannot be later than the project deadline." });
  }
  if (!["Low", "Medium", "High"].includes(priority)) return res.status(400).json({ message: "Invalid task priority." });
  if (assigneeId && !mongoose.isValidObjectId(assigneeId)) {
    return res.status(400).json({ message: "Invalid task assignee." });
  }
  if (assigneeId && !isWorkspaceMember(req.workspace, assigneeId)) {
    return res.status(400).json({ message: "Assignee must be a member of this workspace." });
  }

  const task = await Task.create({
    project: project._id,
    title: title.trim(),
    description,
    status,
    completedAt: status === "Completed" ? new Date() : null,
    priority,
    dueDate,
    assignee: assigneeId || null,
    createdBy: req.user._id,
  });
  await task.populate("assignee", "name email");
  await publishTaskActivity(req, {
    type: "task_created",
    taskId: task._id,
    projectId: project._id,
    notificationRecipients: assigneeId ? [assigneeId] : [],
    notificationType: "task_assigned",
    notificationMessage: `You were assigned to task: ${task.title}`,
  });
  await createNotifications(req, {
    recipientIds: [project.owner],
    type: "task_created",
    message: `${req.user.name} created a task in ${project.name}: ${task.title}`,
    taskId: task._id,
    projectId: project._id,
  });
  res.status(201).json({ task });
});

router.patch("/:id", validateParams("id"), validateBody(taskUpdateFields, { requireAtLeastOne: true }), async (req, res) => {
  const task = await Task.findById(req.params.id).populate("project", "workspace");
  if (!task || String(task.project?.workspace) !== String(req.workspace._id)) {
    return res.status(404).json({ message: "Task not found." });
  }

  const submittedKeys = Object.keys(req.body || {});
  if (!submittedKeys.length || submittedKeys.some((key) => !taskFields.includes(key))) {
    return res.status(400).json({ message: "No valid task fields were provided." });
  }

  if (req.membership.role === "Member") {
    const isAssignee = String(task.assignee || "") === String(req.user._id);
    if (!isAssignee) {
      return res.status(403).json({ message: "Only the assigned member or an Administrator can update this task." });
    }
    if (submittedKeys.some((key) => key !== "status")) {
      return res.status(403).json({ message: "Assigned members can only update task status. Ask an Administrator to edit other task details." });
    }
  }

  if ("status" in req.body && !validStatuses.includes(req.body.status)) {
    return res.status(400).json({ message: "Invalid task status." });
  }
  if ("priority" in req.body && !["Low", "Medium", "High"].includes(req.body.priority)) {
    return res.status(400).json({ message: "Invalid task priority." });
  }
  if ("dueDate" in req.body) {
    if (!isDateOnly(req.body.dueDate)) {
      return res.status(400).json({ message: "A valid task due date is required." });
    }
    if (req.body.dueDate < getDateOnlyInTimeZone()) {
      return res.status(400).json({ message: "Task due date cannot be earlier than today." });
    }
    const project = await Project.findById(task.project._id).select("deadline");
    if (project?.deadline && req.body.dueDate > project.deadline) {
      return res.status(400).json({ message: "Task due date cannot be later than the project deadline." });
    }
  }

  const previousAssigneeId = task.assignee ? String(task.assignee) : null;
  if ("assigneeId" in req.body) {
    const { assigneeId } = req.body;
    if (assigneeId && !mongoose.isValidObjectId(assigneeId)) {
      return res.status(400).json({ message: "Invalid task assignee." });
    }
    if (assigneeId && !isWorkspaceMember(req.workspace, assigneeId)) {
      return res.status(400).json({ message: "Assignee must be a member of this workspace." });
    }
    task.assignee = assigneeId || null;
  }

  const previousStatus = task.status;
  for (const key of ["title", "description", "status", "priority", "dueDate"]) {
    if (key in req.body) task[key] = req.body[key];
  }
  // Record the moment a task is first moved into Completed. Keep the last
  // completion timestamp if it is reopened; a later completion overwrites it.
  if ("status" in req.body && req.body.status === "Completed" && previousStatus !== "Completed") {
    task.completedAt = new Date();
  }
  if ("title" in req.body && !String(req.body.title).trim()) {
    return res.status(400).json({ message: "Task title cannot be empty." });
  }

  await task.save();
  const currentAssigneeId = task.assignee ? String(task.assignee) : null;
  await task.populate("assignee", "name email");
  await task.populate("comments.author", "name");

  const assignmentChanged = previousAssigneeId !== currentAssigneeId;
  const recipients = assignmentChanged ? [previousAssigneeId, currentAssigneeId].filter(Boolean) : [];
  await publishTaskActivity(req, {
    type: assignmentChanged ? "task_reassigned" : "task_updated",
    taskId: task._id,
    projectId: task.project._id,
    notificationRecipients: recipients,
    notificationType: assignmentChanged ? "task_reassigned" : null,
    notificationMessage: (recipientId) => recipientId === currentAssigneeId
      ? `You were assigned to task: ${task.title}`
      : `You are no longer assigned to task: ${task.title}`,
  });

  const statusChanged = "status" in req.body && previousStatus !== task.status;
  if (statusChanged) {
    await createNotifications(req, {
      recipientIds: [task.createdBy, task.assignee],
      type: "task_status_changed",
      message: `${req.user.name} changed the status of ${task.title} to ${task.status}`,
      taskId: task._id,
      projectId: task.project._id,
    });
  }
  const detailsChanged = ["title", "description", "priority", "dueDate"].some((key) => key in req.body);
  if (detailsChanged && !assignmentChanged) {
    await createNotifications(req, {
      recipientIds: [task.assignee],
      type: "task_updated",
      message: `${req.user.name} updated the details of your task: ${task.title}`,
      taskId: task._id,
      projectId: task.project._id,
    });
  }
  res.json({ task });
});

router.delete("/:id", requireRole("Administrator"), validateParams("id"), async (req, res) => {
  const task = await Task.findById(req.params.id).populate("project", "workspace");
  if (!task || String(task.project?.workspace) !== String(req.workspace._id)) return res.status(404).json({ message: "Task not found." });
  const deletedTaskId = task._id;
  await createNotifications(req, {
    recipientIds: [task.assignee, task.createdBy],
    type: "task_deleted",
    message: `Task deleted: ${task.title}`,
    taskId: null,
    projectId: task.project._id,
  });
  await task.deleteOne();
  await publishTaskActivity(req, { type: "task_deleted", taskId: deletedTaskId });
  res.json({ message: "Task deleted." });
});

router.post("/:id/comments", validateParams("id"), validateBody({
  text: { type: "string", required: true, maxLength: 2000, label: "Comment" },
}), async (req, res) => {
  const task = await Task.findById(req.params.id).populate("project", "workspace");
  if (!task || String(task.project?.workspace) !== String(req.workspace._id)) return res.status(404).json({ message: "Task not found." });
  if (req.membership.role === "Member" && String(task.assignee || "") !== String(req.user._id)) {
    return res.status(403).json({ message: "Only the assigned member or an Administrator can comment on this task." });
  }
  if (typeof req.body.text !== "string" || !req.body.text.trim()) {
    return res.status(400).json({ message: "Comment cannot be empty." });
  }
  task.comments.push({ author: req.user._id, text: req.body.text.trim() });
  await task.save();
  await task.populate("assignee", "name email");
  await task.populate("comments.author", "name");

  await publishTaskActivity(req, {
    type: "task_commented",
    taskId: task._id,
    projectId: task.project._id,
    notificationRecipients: [task.assignee?._id, task.createdBy],
    notificationType: "task_commented",
    notificationMessage: `${req.user.name} commented on task: ${task.title}`,
  });
  res.status(201).json({ comments: task.comments });
});

export default router;
