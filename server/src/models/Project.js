import mongoose from "mongoose";

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  description: { type: String, trim: true, maxlength: 500, default: "" },
  status: { type: String, enum: ["In Progress", "Completed", "On Hold"], default: "In Progress" },
  deadline: { type: String, default: "" },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", index: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
}, { timestamps: true });

export default mongoose.model("Project", projectSchema);
