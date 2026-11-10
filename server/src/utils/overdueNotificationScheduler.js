import Project from "../models/Project.js";
import Task from "../models/Task.js";
import User from "../models/User.js";
import Workspace from "../models/Workspace.js";
import { createNotifications } from "./createNotifications.js";

const REMINDER_DAYS = [3, 1, 0];

function getTodayInAppTimeZone() {
  const timeZone = process.env.APP_TIME_ZONE || "Asia/Kolkata";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function daysFromToday(dateKey, todayKey) {
  const toUtcDay = (value) => {
    const [year, month, day] = value.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((toUtcDay(dateKey) - toUtcDay(todayKey)) / 86400000);
}

async function reminderRecipients(candidateIds, daysBefore) {
  const ids = [...new Set(candidateIds.filter(Boolean).map(String))];
  if (!ids.length) return [];
  const users = await User.find({ _id: { $in: ids } }).select("_id notificationPreferences").lean();
  return users.filter((user) => {
    const settings = user.notificationPreferences?.dueSoon;
    if (settings?.enabled === false) return false;
    const selectedDays = settings?.daysBefore ?? REMINDER_DAYS;
    return selectedDays.includes(daysBefore);
  }).map((user) => user._id);
}

/** Runs an idempotent scan for due-soon and overdue reminders using calendar dates in APP_TIME_ZONE. */
export async function scanAndNotifyOverdue(io) {
  const today = getTodayInAppTimeZone();
  const req = { app: { get: (key) => key === "io" ? io : undefined } };
  const taskQuery = {
    status: { $ne: "Completed" },
    dueDate: { $exists: true, $ne: "" },
  };
  const tasks = await Task.find(taskQuery)
    .populate({ path: "project", select: "_id workspace name" })
    .lean();

  let taskReminders = 0;
  let overdueTasks = 0;
  for (const task of tasks) {
    if (!task.project?.workspace || !/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate)) continue;
    const delta = daysFromToday(task.dueDate, today);
    if (delta < 0) {
      const created = await createNotifications(req, {
        workspaceId: task.project.workspace,
        recipientIds: [task.assignee, task.createdBy],
        type: "task_overdue",
        message: `Task overdue: ${task.title} (due ${task.dueDate})`,
        taskId: task._id,
        projectId: task.project._id,
        eventKey: `task-overdue:${task._id}:${task.dueDate}`,
        actorId: null,
        actorName: "TeamSync",
      });
      overdueTasks += created.length;
      continue;
    }
    if (!REMINDER_DAYS.includes(delta)) continue;
    const recipients = await reminderRecipients([task.assignee, task.createdBy], delta);
    const created = await createNotifications(req, {
      workspaceId: task.project.workspace,
      recipientIds: recipients,
      type: "task_due_soon",
      message: delta === 0
        ? `Task due today: ${task.title}`
        : `Task due in ${delta} day${delta === 1 ? "" : "s"}: ${task.title}`,
      taskId: task._id,
      projectId: task.project._id,
      eventKey: `task-due-soon:${task._id}:${task.dueDate}:${delta}`,
      actorId: null,
      actorName: "TeamSync",
    });
    taskReminders += created.length;
  }

  const projects = await Project.find({ deadline: { $exists: true, $ne: "" } }).lean();
  let projectReminders = 0;
  let overdueProjects = 0;
  for (const project of projects) {
    if (!project.workspace || !/^\d{4}-\d{2}-\d{2}$/.test(project.deadline)) continue;
    const delta = daysFromToday(project.deadline, today);
    const workspace = await Workspace.findById(project.workspace).select("members").lean();
    if (!workspace) continue;
    const admins = workspace.members.filter((member) => member.role === "Administrator").map((member) => member.user);
    const recipients = [...new Set([project.owner, ...admins].filter(Boolean).map(String))];

    if (delta < 0 && project.status !== "Completed") {
      const created = await createNotifications(req, {
        workspaceId: project.workspace,
        recipientIds: recipients,
        type: "project_overdue",
        message: `Project deadline passed: ${project.name} (deadline ${project.deadline})`,
        projectId: project._id,
        eventKey: `project-overdue:${project._id}:${project.deadline}`,
        actorId: null,
        actorName: "TeamSync",
      });
      overdueProjects += created.length;
      continue;
    }
    if (project.status === "Completed" || !REMINDER_DAYS.includes(delta)) continue;
    const enabledRecipients = await reminderRecipients(recipients, delta);
    const created = await createNotifications(req, {
      workspaceId: project.workspace,
      recipientIds: enabledRecipients,
      type: "project_due_soon",
      message: delta === 0
        ? `Project deadline is today: ${project.name}`
        : `Project deadline in ${delta} day${delta === 1 ? "" : "s"}: ${project.name}`,
      projectId: project._id,
      eventKey: `project-due-soon:${project._id}:${project.deadline}:${delta}`,
      actorId: null,
      actorName: "TeamSync",
    });
    projectReminders += created.length;
  }

  return { taskReminders, projectReminders, overdueTasks, overdueProjects, checkedAt: new Date().toISOString() };
}

export function startOverdueNotificationScheduler(io) {
  const run = () => scanAndNotifyOverdue(io).catch((error) => {
    console.error("Deadline notification scan failed:", error);
  });
  void run();
  // Six-hour scans are idempotent; the first scan inside a reminder date window delivers it.
  const interval = setInterval(run, 6 * 60 * 60 * 1000);
  interval.unref?.();
  return () => clearInterval(interval);
}
