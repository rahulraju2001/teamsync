import { Router } from "express";
import crypto from "node:crypto";
import User from "../models/User.js";
import Workspace from "../models/Workspace.js";
import Project from "../models/Project.js";
import Task from "../models/Task.js";
import Notification from "../models/Notification.js";
import { protect, requireRole } from "../middleware/auth.js";
import { createNotifications } from "../utils/createNotifications.js";

const router = Router();
router.use(protect);

const memberView = (member) => ({
  id: member.user?._id || member.user,
  name: member.user?.name || "Unknown user",
  email: member.user?.email || "",
  role: member.role,
  joinedAt: member.joinedAt,
});

// Get all workspaces the current user belongs to
router.get("/list", async (req, res, next) => {
  try {
    const workspaces = await Workspace.find({
      "members.user": req.user._id,
    })
      .select("name owner members createdAt")
      .populate("owner", "name email")
      .sort({ createdAt: 1 });

    const result = workspaces.map((workspace) => {
      const membership = workspace.members.find(
        (member) => member.user.toString() === req.user._id.toString(),
      );

      return {
        _id: workspace._id,
        name: workspace.name,
        owner: workspace.owner,
        role: membership?.role || "Member",
        createdAt: workspace.createdAt,
      };
    });

    res.json({ workspaces: result });
  } catch (error) {
    return next(error);
  }
});

// Create a new workspace
router.post("/create", async (req, res, next) => {
  try {
    const name = req.body.name?.trim();

    if (!name) {
      return res.status(400).json({
        message: "Workspace name is required.",
      });
    }

    if (name.length > 80) {
      return res.status(400).json({
        message: "Workspace name cannot exceed 80 characters.",
      });
    }

    const workspace = await Workspace.create({
      name,
      owner: req.user._id,
      members: [
        {
          user: req.user._id,
          role: "Administrator",
        },
      ],
    });

    req.user.activeWorkspace = workspace._id;
    req.user.role = "Administrator";
    await req.user.save();
    req.app.get("io")?.to(`user:${String(req.user._id)}`).emit("workspace:changed", {
      workspaceId: String(workspace._id),
    });

    res.status(201).json({
      message: "Workspace created successfully.",
      workspace: {
        _id: workspace._id,
        name: workspace.name,
        owner: workspace.owner,
        role: "Administrator",
      },
    });
  } catch (error) {
    return next(error);
  }
});

// Switch the current user's active workspace
router.post("/switch/:workspaceId", async (req, res, next) => {
  try {
    const workspace = await Workspace.findOne({
      _id: req.params.workspaceId,
      "members.user": req.user._id,
    });

    if (!workspace) {
      return res.status(404).json({
        message: "Workspace not found or you are not a member.",
      });
    }

    const membership = workspace.members.find(
      (member) => member.user.toString() === req.user._id.toString(),
    );

    req.user.activeWorkspace = workspace._id;
    req.user.role = membership.role;
    await req.user.save();
    req.app.get("io")?.to(`user:${String(req.user._id)}`).emit("workspace:changed", {
      workspaceId: String(workspace._id),
    });

    res.json({
      message: "Workspace switched successfully.",
      workspace: {
        _id: workspace._id,
        name: workspace.name,
        owner: workspace.owner,
        role: membership.role,
      },
    });
  } catch (error) {
    return next(error);
  }
});


// Leave the active workspace. The fixed workspace owner cannot leave, and the last Administrator must remain.
router.post("/leave", async (req, res, next) => {
  try {
    const workspace = req.workspace;
    const userId = String(req.user._id);

    if (String(workspace.owner) === userId) {
      return res.status(400).json({
        message: "Workspace owners cannot leave their workspace. Delete the workspace if you no longer need it.",
      });
    }

    if (
      req.membership.role === "Administrator" &&
      workspace.members.filter((member) => member.role === "Administrator").length <= 1
    ) {
      return res.status(400).json({
        message: "You are the last Administrator. Promote another member to Administrator before leaving.",
      });
    }

    workspace.members = workspace.members.filter(
      (member) => String(member.user) !== userId,
    );
    await workspace.save();
    await createNotifications(req, {
      workspaceId: workspace._id,
      recipientIds: workspace.members.filter((member) => member.role === "Administrator").map((member) => member.user),
      type: "workspace_member_left",
      message: `${req.user.name} left the workspace`,
    });

    // Switch to another workspace if the user belongs to one. Otherwise,
    // create a fresh personal workspace so the app always has an active one.
    let nextWorkspace = await Workspace.findOne({ "members.user": req.user._id }).sort({ createdAt: 1 });
    if (!nextWorkspace) {
      nextWorkspace = await Workspace.create({
        name: `${req.user.name}'s Workspace`,
        owner: req.user._id,
        members: [{ user: req.user._id, role: "Administrator" }],
      });
    }

    const nextMembership = nextWorkspace.members.find(
      (member) => String(member.user) === userId,
    );
    req.user.activeWorkspace = nextWorkspace._id;
    req.user.role = nextMembership?.role || "Administrator";
    await req.user.save({ validateBeforeSave: false });

    const io = req.app.get("io");
    io?.to(`workspace:${String(workspace._id)}`).emit("workspace:member_changed", {
      workspaceId: String(workspace._id),
      userId,
      action: "member_left",
    });
    io?.to(`user:${userId}`).emit("workspace:changed", {
      workspaceId: String(nextWorkspace._id),
      previousWorkspaceId: String(workspace._id),
      action: "left",
    });
    io?.in(`user:${userId}:workspace:${String(workspace._id)}`).disconnectSockets(true);

    return res.json({
      message: `You left ${workspace.name}.`,
      workspace: { _id: nextWorkspace._id, name: nextWorkspace.name, role: req.user.role },
    });
  } catch (error) {
    return next(error);
  }
});

// Delete a workspace and all project/task/notification data belonging to it.
// Only the recorded workspace owner may perform this operation.
router.delete("/", async (req, res, next) => {
  try {
    const workspace = req.workspace;
    if (String(workspace.owner) !== String(req.user._id)) {
      return res.status(403).json({ message: "Only the workspace owner can delete this workspace." });
    }

    const workspaceId = workspace._id;
    const memberIds = workspace.members.map((member) => member.user);
    const projects = await Project.find({ workspace: workspaceId }).select("_id");
    const projectIds = projects.map((project) => project._id);

    if (projectIds.length) {
      await Task.deleteMany({ project: { $in: projectIds } });
    }
    await Project.deleteMany({ workspace: workspaceId });
    await Notification.deleteMany({ workspace: workspaceId });

    // Move each affected user to another existing workspace, or create a
    // personal workspace before notifying clients. This avoids concurrent
    // API requests creating duplicate fallback workspaces after deletion.
    for (const memberId of memberIds) {
      const memberUser = await User.findOne({
        _id: memberId,
        activeWorkspace: workspaceId,
      });
      if (!memberUser) continue;

      let nextWorkspace = await Workspace.findOne({
        _id: { $ne: workspaceId },
        "members.user": memberId,
      }).sort({ createdAt: 1 });

      if (!nextWorkspace) {
        nextWorkspace = await Workspace.create({
          name: `${memberUser.name}'s Workspace`,
          owner: memberId,
          members: [{ user: memberId, role: "Administrator" }],
        });
      }

      const nextMembership = nextWorkspace.members.find(
        (member) => String(member.user) === String(memberId),
      );
      memberUser.activeWorkspace = nextWorkspace._id;
      memberUser.role = nextMembership?.role || "Administrator";
      await memberUser.save({ validateBeforeSave: false });
    }

    await workspace.deleteOne();

    const io = req.app.get("io");
    for (const memberId of memberIds) {
      const id = String(memberId);
      io?.to(`user:${id}`).emit("workspace:changed", {
        workspaceId: null,
        deletedWorkspaceId: String(workspaceId),
        action: "deleted",
      });
      io?.in(`user:${id}:workspace:${String(workspaceId)}`).disconnectSockets(true);
    }

    return res.json({ message: "Workspace and all its projects, tasks, and notifications were deleted." });
  } catch (error) {
    return next(error);
  }
});

router.get("/", async (req, res) => {
  const workspace = await Workspace.findById(req.workspace._id)
    .populate("members.user", "name email")
    .populate("invitations.invitedBy", "name email");
  res.json({
    workspace: {
      id: workspace._id,
      name: workspace.name,
      owner: workspace.owner,
    },
    role: req.membership.role,
    members: workspace.members.map(memberView),
    invitations: workspace.invitations.map((invite) => ({
      id: invite._id,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      invitedBy: invite.invitedBy?.name || "Administrator",
    })),
  });
});

router.patch("/", requireRole("Administrator"), async (req, res) => {
  const name = req.body.name?.trim();
  if (!name)
    return res.status(400).json({ message: "Workspace name is required." });
  if (name.length > 80)
    return res
      .status(400)
      .json({ message: "Workspace name must be 80 characters or fewer." });
  const previousName = req.workspace.name;
  req.workspace.name = name;
  await req.workspace.save();
  await createNotifications(req, {
    recipientIds: req.workspace.members.map((member) => member.user),
    type: "workspace_renamed",
    message: `${req.user.name} renamed the workspace from ${previousName} to ${name}`,
  });
  req.app.get("io")?.to(`workspace:${String(req.workspace._id)}`).emit("workspace:changed", {
    workspaceId: String(req.workspace._id), action: "renamed",
  });
  res.json({ workspace: { id: req.workspace._id, name: req.workspace.name } });
});

router.post("/invitations", requireRole("Administrator"), async (req, res) => {
  const email = req.body.email?.toLowerCase().trim();
  if (!email || !/^\S+@\S+\.\S+$/.test(email))
    return res.status(400).json({ message: "Enter a valid email address." });
  const existingUser = await User.findOne({ email });
  if (
    existingUser &&
    req.workspace.members.some(
      (member) => String(member.user) === String(existingUser._id),
    )
  ) {
    return res
      .status(409)
      .json({ message: "This person is already a workspace member." });
  }
  req.workspace.invitations = req.workspace.invitations.filter(
    (invite) => invite.email !== email && invite.expiresAt > new Date(),
  );
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  req.workspace.invitations.push({
    email,
    tokenHash,
    role: "Member",
    invitedBy: req.user._id,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  await req.workspace.save();
  const frontendUrl = process.env.CLIENT_URL || "http://localhost:5173";
  res
    .status(201)
    .json({
      message: "Invitation link created. Share it with the invited person.",
      invitationUrl: `${frontendUrl}/invite/${token}`,
      email,
    });
});

router.post("/invitations/accept", async (req, res) => {
  const token = req.body.token;
  if (!token || typeof token !== "string")
    return res.status(400).json({ message: "Invitation token is required." });
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const workspace = await Workspace.findOne({
    invitations: { $elemMatch: { tokenHash, expiresAt: { $gt: new Date() } } },
  });
  if (!workspace)
    return res
      .status(404)
      .json({ message: "This invitation is invalid or has expired." });
  const invite = workspace.invitations.find(
    (item) => item.tokenHash === tokenHash,
  );
  if (invite.email !== req.user.email)
    return res
      .status(403)
      .json({
        message: `This invitation was sent to ${invite.email}. Sign in with that email address.`,
      });
  if (
    workspace.members.some(
      (member) => String(member.user) === String(req.user._id),
    )
  ) {
    workspace.invitations = workspace.invitations.filter(
      (item) => item.tokenHash !== tokenHash,
    );
    await workspace.save();
    return res.json({ message: "You are already a member of this workspace." });
  }
  workspace.members.push({ user: req.user._id, role: "Member" });
  workspace.invitations = workspace.invitations.filter(
    (item) => item.tokenHash !== tokenHash,
  );
  await workspace.save();
  req.user.activeWorkspace = workspace._id;
  req.user.role = "Member";
  await req.user.save({ validateBeforeSave: false });
  await createNotifications(req, {
    workspaceId: workspace._id,
    recipientIds: workspace.members.filter((member) => member.role === "Administrator").map((member) => member.user),
    type: "workspace_member_joined",
    message: `${req.user.name} joined ${workspace.name}`,
  });
  req.app.get("io")?.to(`user:${String(req.user._id)}`).emit("workspace:changed", {
    workspaceId: String(workspace._id),
  });
  res.json({
    message: `You joined ${workspace.name}.`,
    workspace: { id: workspace._id, name: workspace.name },
    role: "Member",
  });
});

router.patch(
  "/members/:userId/role",
  requireRole("Administrator"),
  async (req, res) => {
    const { role } = req.body;
    if (!["Administrator", "Member"].includes(role))
      return res.status(400).json({ message: "Invalid role." });
    const member = req.workspace.members.find(
      (item) => String(item.user) === req.params.userId,
    );
    if (!member)
      return res.status(404).json({ message: "Workspace member not found." });
    if (
      String(req.workspace.owner) === req.params.userId &&
      role !== "Administrator"
    )
      return res
        .status(400)
        .json({ message: "The workspace owner must remain an Administrator." });
    if (member.role === "Administrator" && role === "Member") {
      const admins = req.workspace.members.filter(
        (item) => item.role === "Administrator",
      );
      if (admins.length <= 1)
        return res
          .status(400)
          .json({
            message: "A workspace must have at least one Administrator.",
          });
    }
    member.role = role;
    await req.workspace.save();
    const targetUser = await User.findById(req.params.userId);
    if (
      targetUser &&
      String(targetUser.activeWorkspace) === String(req.workspace._id)
    ) {
      targetUser.role = role;
      await targetUser.save({ validateBeforeSave: false });
    }
    await createNotifications(req, {
      recipientIds: [req.params.userId],
      type: "workspace_role_changed",
      message: `${req.user.name} changed your workspace role to ${role}`,
    });
    req.app.get("io")?.to(`workspace:${String(req.workspace._id)}`).emit("workspace:member_changed", {
      workspaceId: String(req.workspace._id), userId: req.params.userId, action: "role_changed",
    });
    res.json({
      message: "Member role updated.",
      member: { id: req.params.userId, role },
    });
  },
);

router.delete(
  "/members/:userId",
  requireRole("Administrator"),
  async (req, res) => {
    if (String(req.workspace.owner) === req.params.userId)
      return res
        .status(400)
        .json({ message: "The workspace owner cannot be removed." });
    const member = req.workspace.members.find(
      (item) => String(item.user) === req.params.userId,
    );
    if (!member)
      return res.status(404).json({ message: "Workspace member not found." });
    if (
      member.role === "Administrator" &&
      req.workspace.members.filter((item) => item.role === "Administrator")
        .length <= 1
    ) {
      return res
        .status(400)
        .json({ message: "A workspace must have at least one Administrator." });
    }
    req.workspace.members = req.workspace.members.filter(
      (item) => String(item.user) !== req.params.userId,
    );
    await req.workspace.save();
    const removedUser = await User.findById(req.params.userId).select("name");
    await createNotifications(req, {
      recipientIds: req.workspace.members.filter((item) => item.role === "Administrator").map((item) => item.user),
      type: "workspace_member_removed",
      message: `${removedUser?.name || "A member"} was removed from the workspace by ${req.user.name}`,
    });
    const user = await User.findById(req.params.userId);
    if (user && String(user.activeWorkspace) === String(req.workspace._id))
      user.activeWorkspace = null;
    if (user) await user.save({ validateBeforeSave: false });

    const io = req.app.get("io");
    if (io && user) {
      io.to(`user:${String(user._id)}`).emit("workspace:changed", { workspaceId: null });
      io.in(`user:${String(user._id)}:workspace:${String(req.workspace._id)}`)
        .disconnectSockets(true);
    }
    res.json({ message: "Member removed from workspace." });
  },
);

export default router;
