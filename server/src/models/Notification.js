import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: {
    type: String,
    enum: ["task_created", "task_updated", "task_deleted", "task_commented"],
    required: true,
  },
  message: { type: String, required: true, maxlength: 250 },
  taskId: { type: mongoose.Schema.Types.ObjectId, default: null },
  readAt: { type: Date, default: null },
}, { timestamps: true });

notificationSchema.index({ recipient: 1, workspace: 1, createdAt: -1 });
export default mongoose.model("Notification", notificationSchema);
