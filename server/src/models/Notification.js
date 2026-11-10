import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  type: {
    type: String,
    enum: [
      "task_created", "task_updated", "task_deleted", "task_commented", "task_assigned", "task_reassigned",
      "task_status_changed", "task_overdue", "task_due_soon", "project_created", "project_updated", "project_deleted",
      "project_overdue", "project_due_soon", "workspace_role_changed", "workspace_member_left", "workspace_renamed",
    ],
    required: true,
  },
  message: { type: String, required: true, maxlength: 250 },
  taskId: { type: mongoose.Schema.Types.ObjectId, default: null },
  projectId: { type: mongoose.Schema.Types.ObjectId, default: null },
  eventKey: { type: String, unique: true, sparse: true },
  readAt: { type: Date, default: null },
}, { timestamps: true });

notificationSchema.index({ recipient: 1, workspace: 1, createdAt: -1 });
export default mongoose.model("Notification", notificationSchema);
