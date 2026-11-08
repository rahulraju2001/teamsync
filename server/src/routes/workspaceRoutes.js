import { Router } from "express";
import crypto from "node:crypto";
import User from "../models/User.js";
import Workspace from "../models/Workspace.js";
import { protect, requireRole } from "../middleware/auth.js";

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
router.get("/list", async (req, res) => {
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
    res.status(500).json({ message: "Could not load workspaces." });
  }
});

// Create a new workspace
router.post("/create", async (req, res) => {
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
    res.status(500).json({ message: "Could not create workspace." });
  }
});

// Switch the current user's active workspace
router.post("/switch/:workspaceId", async (req, res) => {
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
    res.status(500).json({ message: "Could not switch workspace." });
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
  req.workspace.name = name;
  await req.workspace.save();
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
    const user = await User.findById(req.params.userId);
    if (user && String(user.activeWorkspace) === String(req.workspace._id))
      user.activeWorkspace = null;
    if (user) await user.save({ validateBeforeSave: false });
    res.json({ message: "Member removed from workspace." });
  },
);

export default router;
