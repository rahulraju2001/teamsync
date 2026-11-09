import Notification from "../models/Notification.js";
import User from "../models/User.js";

/** Broadcast task changes to everyone in the workspace, and optionally persist
 * targeted notifications for selected members. */
export async function publishTaskActivity(req, {
  type,
  taskId,
  notificationRecipients = [],
  notificationType,
  notificationMessage,
}) {
  const workspaceId = String(req.workspace._id);
  const actorId = String(req.user._id);
  const io = req.app.get("io");

  io?.to(`workspace:${workspaceId}`).emit("task:changed", {
    type,
    taskId: String(taskId),
    workspaceId,
    actorId,
  });

  if (!notificationType || !notificationMessage) return;

  const recipients = [...new Set(notificationRecipients
    .map((recipient) => String(recipient?._id || recipient))
    .filter((recipient) => recipient && recipient !== actorId))];
  if (!recipients.length) return;

  let documents;
  try {
    const recipientUsers = await User.find({ _id: { $in: recipients } })
      .select("_id notificationPreferences")
      .lean();
    const enabledRecipientIds = new Set(
      recipientUsers
        .filter((user) => user.notificationPreferences?.inApp !== false)
        .map((user) => String(user._id)),
    );
    const optedInRecipients = recipients.filter((recipient) => enabledRecipientIds.has(recipient));
    if (!optedInRecipients.length) return;

    documents = await Notification.insertMany(optedInRecipients.map((recipient) => ({
      recipient,
      workspace: req.workspace._id,
      actor: req.user._id,
      type: notificationType,
      message: typeof notificationMessage === "function"
        ? notificationMessage(recipient)
        : notificationMessage,
      taskId,
    })));
  } catch (error) {
    // Do not fail a successful task operation because notification persistence failed.
    console.error("Could not persist task notifications:", error);
    return;
  }

  for (const notification of documents) {
    io?.to(`user:${String(notification.recipient)}:workspace:${workspaceId}`).emit("notification:new", {
      _id: String(notification._id),
      type: notification.type,
      message: notification.message,
      taskId: notification.taskId ? String(notification.taskId) : null,
      workspaceId,
      actor: { _id: actorId, name: req.user.name },
      readAt: null,
      createdAt: notification.createdAt,
    });
  }
}
