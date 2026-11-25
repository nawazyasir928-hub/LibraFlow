const mongoose = require("mongoose");
const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: "Member", default: null, index: true },
  audience: { type: String, enum: ["all", "admins", "members"], default: "all" },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  message: { type: String, required: true, trim: true, maxlength: 1000 },
  type: { type: String, enum: ["info", "success", "warning", "alert"], default: "info" },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "Member" }]
}, { timestamps: true });
notificationSchema.index({ createdAt: -1 });
module.exports = mongoose.model("Notification", notificationSchema);
