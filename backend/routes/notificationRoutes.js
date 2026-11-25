const express = require("express");
const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const { protect, adminOnly } = require("../middleware/authMiddleware");
const { sendEmail } = require("../services/emailService");
const Member = require("../models/Member");
const router = express.Router();
router.use(protect);
router.get("/", async (req, res) => {
  try {
    const audience = req.user.role === "admin" ? ["all", "admins"] : ["all", "members"];
    const filter = { $or: [{ recipient: req.user._id }, { recipient: null, audience: { $in: audience } }] };
    const notifications = await Notification.find(filter).sort({ createdAt: -1 }).limit(100).lean();
    const data = notifications.map(n => ({ ...n, isRead: n.readBy.some(id => id.toString() === req.user._id.toString()) }));
    res.json({ notifications: data, unread: data.filter(n => !n.isRead).length });
  } catch { res.status(500).json({ message: "Could not load notifications." }); }
});
router.patch("/:id/read", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid notification ID." });
    const item = await Notification.findOneAndUpdate({ _id: req.params.id, $or: [{ recipient: req.user._id }, { recipient: null, audience: req.user.role === "admin" ? { $in: ["all", "admins"] } : { $in: ["all", "members"] } }] }, { $addToSet: { readBy: req.user._id } }, { new: true });
    if (!item) return res.status(404).json({ message: "Notification not found." });
    res.json({ message: "Notification marked as read." });
  } catch { res.status(500).json({ message: "Could not update notification." }); }
});
router.post("/", adminOnly, async (req, res) => {
  try {
    const { title, message, audience = "all", type = "info" } = req.body;
    if (!title?.trim() || !message?.trim()) return res.status(400).json({ message: "Title and message are required." });
    if (!["all", "admins", "members"].includes(audience) || !["info", "success", "warning", "alert"].includes(type)) return res.status(400).json({ message: "Invalid notification audience or type." });
    const notification = await Notification.create({ title, message, audience, type });
    req.app.get("io")?.emit("library:notification", { audience });
    res.status(201).json(notification);
  } catch (error) { res.status(400).json({ message: error.message }); }
});

router.post("/email", adminOnly, async (req, res) => {
  try {
    const { to, subject, message } = req.body;
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || !subject?.trim() || !message?.trim())
      return res.status(400).json({ message: "Enter a valid recipient email, subject and message." });
    await sendEmail({ to, subject: subject.trim(), text: message.trim() });
    res.json({ message: "Email sent successfully." });
  } catch (error) { res.status(503).json({ message: error.message || "Email could not be sent." }); }
});
router.delete("/:id", adminOnly, async (req, res) => {
  try {
    const deleted = await Notification.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Notification not found." });
    res.json({ message: "Notification deleted." });
  } catch { res.status(400).json({ message: "Could not delete notification." }); }
});
module.exports = router;
