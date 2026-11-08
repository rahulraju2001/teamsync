import mongoose from "mongoose";

const memberSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  role: { type: String, enum: ["Administrator", "Member"], default: "Member" },
  joinedAt: { type: Date, default: Date.now },
}, { _id: false });

const invitationSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true },
  tokenHash: { type: String, required: true },
  role: { type: String, enum: ["Member"], default: "Member" },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
});

const workspaceSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  members: { type: [memberSchema], default: [] },
  invitations: { type: [invitationSchema], default: [] },
}, { timestamps: true });

workspaceSchema.index({ "members.user": 1 });
export default mongoose.model("Workspace", workspaceSchema);
