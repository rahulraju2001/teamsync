import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const notificationPreferencesSchema = new mongoose.Schema({
  inApp: { type: Boolean, default: true },
  email: { type: Boolean, default: false },
}, { _id: false });

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 8, select: false },
  // The role is retained for compatibility; workspace membership is authoritative.
  role: { type: String, enum: ["Administrator", "Member"], default: "Member" },
  activeWorkspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", default: null },
  notificationPreferences: {
    type: notificationPreferencesSchema,
    default: () => ({}),
  },
}, { timestamps: true });

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

export default mongoose.model("User", userSchema);
