import { Router } from "express";
import mongoose from "mongoose";
import Notification from "../models/Notification.js";
import { protect } from "../middleware/auth.js";

const router = Router();
router.use(protect);

router.get("/", async (req, res) => {
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 40, 1), 100);
  const notifications = await Notification.find({
    recipient: req.user._id,
    workspace: req.workspace._id,
  })
    .populate("actor", "name")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  res.json({ notifications });
});

router.patch("/read-all", async (req, res) => {
  const result = await Notification.updateMany(
    { recipient: req.user._id, workspace: req.workspace._id, readAt: null },
    { $set: { readAt: new Date() } },
  );
  res.json({ message: "Notifications marked as read.", modifiedCount: result.modifiedCount });
});

router.patch("/:id/read", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: "Notification not found." });
  }

  const notification = await Notification.findOneAndUpdate(
    {
      _id: req.params.id,
      recipient: req.user._id,
      workspace: req.workspace._id,
    },
    { $set: { readAt: new Date() } },
    { new: true },
  );

  if (!notification) return res.status(404).json({ message: "Notification not found." });
  res.json({ notification });
});

export default router;
