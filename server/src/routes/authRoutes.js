import { Router } from "express";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import User from "../models/User.js";
import Workspace from "../models/Workspace.js";
import { protect } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { createRateLimiter } from "../middleware/rateLimit.js";

const router = Router();
const registrationRateLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 5,
  message: "Too many registration attempts. Please try again later.",
});
const loginRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  message: "Too many sign-in attempts. Please try again in 15 minutes.",
});
const createToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });
const publicUser = (user, role) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role,

});

router.post("/register", registrationRateLimit, validateBody({
  name: { type: "string", required: true, maxLength: 60, label: "Name" },
  email: { type: "string", required: true, maxLength: 254, email: true, label: "Email" },
  password: { type: "string", required: true, minLength: 8, maxLength: 128, trim: false, label: "Password" },
  invitationToken: { type: "string", maxLength: 256, trim: false, label: "Invitation token" },
}), async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const normalizedName = name.trim();
    const normalizedEmail = email.toLowerCase().trim();
    if (await User.findOne({ email: normalizedEmail })) return res.status(409).json({ message: "An account with this email already exists." });

    let invitedWorkspace = null;
    let invitation = null;
    if (req.body.invitationToken) {
      const tokenHash = crypto.createHash("sha256").update(String(req.body.invitationToken)).digest("hex");
      invitedWorkspace = await Workspace.findOne({ invitations: { $elemMatch: { tokenHash, email: normalizedEmail, expiresAt: { $gt: new Date() } } } });
      if (!invitedWorkspace) return res.status(400).json({ message: "This invitation is invalid, expired, or was sent to a different email address." });
      invitation = invitedWorkspace.invitations.find((item) => item.tokenHash === tokenHash);
    }

    const role = invitedWorkspace ? "Member" : "Administrator";
    const user = await User.create({ name: normalizedName, email: normalizedEmail, password, role });
    let workspace;
    if (invitedWorkspace && invitation) {
      workspace = invitedWorkspace;
      workspace.members.push({ user: user._id, role: "Member" });
      workspace.invitations = workspace.invitations.filter((item) => item.tokenHash !== invitation.tokenHash);
      await workspace.save();
    } else {
      workspace = await Workspace.create({
        name: `${user.name}'s Workspace`,
        owner: user._id,
        members: [{ user: user._id, role: "Administrator" }],
      });
    }
    user.activeWorkspace = workspace._id;
    await user.save({ validateBeforeSave: false });

    return res.status(201).json({ token: createToken(user._id), user: publicUser(user, role), workspace: { id: workspace._id, name: workspace.name } });
  } catch (error) {
    return next(error);
  }
});

router.post("/login", loginRateLimit, validateBody({
  email: { type: "string", required: true, maxLength: 254, email: true, label: "Email" },
  password: { type: "string", required: true, maxLength: 128, trim: false, label: "Password" },
}), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select("+password");
    if (!user || !(await user.comparePassword(password))) return res.status(401).json({ message: "Email or password is incorrect." });

    let workspace = user.activeWorkspace ? await Workspace.findOne({ _id: user.activeWorkspace, "members.user": user._id }) : null;
    if (!workspace) {
      workspace = await Workspace.findOne({ "members.user": user._id });
      if (!workspace) {
        workspace = await Workspace.create({ name: `${user.name}'s Workspace`, owner: user._id, members: [{ user: user._id, role: "Administrator" }] });
        await (await import("../models/Project.js")).default.updateMany({ owner: user._id, $or: [{ workspace: null }, { workspace: { $exists: false } }] }, { $set: { workspace: workspace._id } });
      }
      user.activeWorkspace = workspace._id;
      await user.save({ validateBeforeSave: false });
    }
    const membership = workspace.members.find((item) => String(item.user) === String(user._id));
    return res.json({ token: createToken(user._id), user: publicUser(user, membership?.role || "Member"), workspace: { id: workspace._id, name: workspace.name } });
  } catch (error) {
    return next(error);
  }
});

router.get("/me", protect, async (req, res) => {
  res.json({ user: publicUser(req.user, req.membership.role), workspace: { id: req.workspace._id, name: req.workspace.name } });
});

router.patch("/profile", protect, async (req, res) => {
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  if (!name) return res.status(400).json({ message: "Name is required." });
  if (name.length > 60) return res.status(400).json({ message: "Name must be 60 characters or fewer." });

  req.user.name = name;
  await req.user.save();
  res.json({ message: "Profile updated successfully.", user: publicUser(req.user, req.membership.role) });
});


export default router;
