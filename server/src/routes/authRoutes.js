import { Router } from "express";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import User from "../models/User.js";
import Workspace from "../models/Workspace.js";
import { protect } from "../middleware/auth.js";

const router = Router();
const createToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });
const publicUser = (user, role) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role,
  notificationPreferences: {
    inApp: user.notificationPreferences?.inApp ?? true,
    email: user.notificationPreferences?.email ?? false,
    dueSoon: {
      enabled: user.notificationPreferences?.dueSoon?.enabled ?? true,
      daysBefore: user.notificationPreferences?.dueSoon?.daysBefore ?? [3, 1, 0],
    },
  },
});

router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name?.trim() || !email?.trim() || !password) return res.status(400).json({ message: "Name, email and password are required." });
    if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters." });
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
    const user = await User.create({ name, email: normalizedEmail, password, role });
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
    return res.status(500).json({ message: "Unable to create account.", error: process.env.NODE_ENV === "development" ? error.message : undefined });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase().trim() }).select("+password");
    if (!user || !(await user.comparePassword(password || ""))) return res.status(401).json({ message: "Email or password is incorrect." });

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
  } catch {
    return res.status(500).json({ message: "Unable to sign in." });
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

router.patch("/preferences", protect, async (req, res) => {
  const { inApp, email, dueSoon } = req.body || {};
  if ((inApp !== undefined && typeof inApp !== "boolean") || (email !== undefined && typeof email !== "boolean")) {
    return res.status(400).json({ message: "Notification preferences must be boolean values." });
  }
  if (dueSoon !== undefined) {
    if (!dueSoon || typeof dueSoon !== "object" || Array.isArray(dueSoon)
      || (dueSoon.enabled !== undefined && typeof dueSoon.enabled !== "boolean")
      || (dueSoon.daysBefore !== undefined && (!Array.isArray(dueSoon.daysBefore)
        || dueSoon.daysBefore.some((value) => ![3, 1, 0].includes(value))
        || new Set(dueSoon.daysBefore).size !== dueSoon.daysBefore.length))) {
      return res.status(400).json({ message: "Due-soon reminder preferences are invalid." });
    }
  }

  if (!req.user.notificationPreferences) req.user.notificationPreferences = { inApp: true, email: false };
  if (inApp !== undefined) req.user.notificationPreferences.inApp = inApp;
  if (email !== undefined) req.user.notificationPreferences.email = email;
  if (dueSoon !== undefined) {
    if (!req.user.notificationPreferences.dueSoon) req.user.notificationPreferences.dueSoon = { enabled: true, daysBefore: [3, 1, 0] };
    if (dueSoon.enabled !== undefined) req.user.notificationPreferences.dueSoon.enabled = dueSoon.enabled;
    if (dueSoon.daysBefore !== undefined) req.user.notificationPreferences.dueSoon.daysBefore = dueSoon.daysBefore;
  }
  await req.user.save();

  res.json({
    message: "Notification preferences saved.",
    notificationPreferences: {
      inApp: req.user.notificationPreferences.inApp,
      email: req.user.notificationPreferences.email,
      dueSoon: {
        enabled: req.user.notificationPreferences.dueSoon?.enabled ?? true,
        daysBefore: req.user.notificationPreferences.dueSoon?.daysBefore ?? [3, 1, 0],
      },
    },
  });
});

export default router;
