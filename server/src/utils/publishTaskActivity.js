import Notification from "../models/Notification.js";

export async function publishTaskActivity(req, { type, taskId, message }) {
  const workspaceId = String(req.workspace._id);
  const actorId = String(req.user._id);
  const io = req.app.get("io");

  io?.to(`workspace:${workspaceId}`).emit("task:changed", {
    type,
    taskId: String(taskId),
    workspaceId,
    actorId,
  });

  const recipients = req.workspace.members
    .map((member) => member.user?._id || member.user)
    .filter((userId) => String(userId) !== actorId);

  if (!recipients.length) return;

  let documents;
  try {
    documents = await Notification.insertMany(recipients.map((recipient) => ({
      recipient,
      workspace: req.workspace._id,
      actor: req.user._id,
      type,
      message,
      taskId,
    })));
  } catch (error) {
    // A notification write failure should not turn a successful task change into an API failure.
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
