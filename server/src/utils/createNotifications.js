import Notification from "../models/Notification.js";
import User from "../models/User.js";
import Workspace from "../models/Workspace.js";

/** Persist in-app notifications and deliver them to the recipient's active workspace socket room. */
export async function createNotifications(req, {
  recipientIds = [],
  type,
  message,
  taskId = null,
  projectId = null,
  eventKey = null,
  actorId = req?.user?._id || null,
  actorName = req?.user?.name || "TeamSync",
  workspaceId = req?.workspace?._id,
}) {
  if (!workspaceId || !type || !message) return [];

  const actor = actorId ? String(actorId) : null;
  let memberIds;
  try {
    const workspace = await Workspace.findById(workspaceId).select("members.user").lean();
    if (!workspace) return [];
    memberIds = new Set(workspace.members.map((member) => String(member.user)));
  } catch (error) {
    console.error("Could not verify notification workspace members:", error);
    return [];
  }
  const recipients = [...new Set(recipientIds.map((id) => String(id?._id || id)).filter((id) => id && id !== actor && memberIds.has(id)))];
  if (!recipients.length) return [];

  let users;
  try {
    users = await User.find({ _id: { $in: recipients } }).select("_id notificationPreferences").lean();
  } catch (error) {
    console.error("Could not load notification recipients:", error);
    return [];
  }
  const enabled = users.filter((user) => user.notificationPreferences?.inApp !== false).map((user) => String(user._id));
  const io = req?.app?.get("io");
  const created = [];

  for (const recipient of enabled) {
    const document = {
      recipient,
      workspace: workspaceId,
      actor: actorId,
      type,
      message: typeof message === "function" ? message(recipient) : message,
      taskId,
      projectId,
      ...(eventKey ? { eventKey: `${eventKey}:${recipient}` } : {}),
    };

    try {
      if (document.eventKey) {
        const result = await Notification.updateOne(
          { eventKey: document.eventKey },
          { $setOnInsert: document },
          { upsert: true },
        );
        if (!result.upsertedCount) continue;
        const saved = await Notification.findOne({ eventKey: document.eventKey }).lean();
        if (saved) created.push(saved);
      } else {
        const [saved] = await Notification.create([document]);
        created.push(saved.toObject());
      }
    } catch (error) {
      if (error?.code === 11000) continue;
      console.error("Could not persist notification:", error);
    }
  }

  for (const notification of created) {
    io?.to(`user:${String(notification.recipient)}:workspace:${String(workspaceId)}`).emit("notification:new", {
      _id: String(notification._id),
      type: notification.type,
      message: notification.message,
      taskId: notification.taskId ? String(notification.taskId) : null,
      projectId: notification.projectId ? String(notification.projectId) : null,
      workspaceId: String(workspaceId),
      actor: actor ? { _id: actor, name: actorName } : null,
      readAt: null,
      createdAt: notification.createdAt,
    });
  }
  return created;
}
