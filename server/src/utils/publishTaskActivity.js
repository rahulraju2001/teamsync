import { createNotifications } from "./createNotifications.js";

/** Broadcast task changes to the workspace and optionally notify selected members. */
export async function publishTaskActivity(req, {
  type,
  taskId,
  projectId = null,
  notificationRecipients = [],
  notificationType,
  notificationMessage,
}) {
  const workspaceId = String(req.workspace._id);
  req.app.get("io")?.to(`workspace:${workspaceId}`).emit("task:changed", {
    type,
    taskId: String(taskId),
    workspaceId,
    actorId: String(req.user._id),
  });

  if (!notificationType || !notificationMessage) return;
  try {
    await createNotifications(req, {
      recipientIds: notificationRecipients,
      type: notificationType,
      message: notificationMessage,
      taskId,
      projectId,
    });
  } catch (error) {
    // A notification failure must not roll back a successful task operation.
    console.error("Could not publish task notifications:", error);
  }
}
