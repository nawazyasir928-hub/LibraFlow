const express = require("express");
const Book = require("../models/Book");
const Member = require("../models/Member");
const BorrowRecord = require("../models/BorrowRecord");
const Notification = require("../models/Notification");
const { protect, adminOnly } = require("../middleware/authMiddleware");
const router = express.Router();
router.use(protect, adminOnly);
router.get("/export", async (req, res) => {
  try {
    const [books, members, borrowRecords, notifications] = await Promise.all([
      Book.find().lean(), Member.find().select("+password").lean(), BorrowRecord.find().lean(), Notification.find().lean()
    ]);
    const backup = { format: "libraflow-backup", version: 1, createdAt: new Date().toISOString(), data: { books, members, borrowRecords, notifications } };
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename=libraflow-backup-${new Date().toISOString().slice(0, 10)}.json`);
    res.send(JSON.stringify(backup));
  } catch (error) { console.error("Backup export:", error); res.status(500).json({ message: "Backup export failed." }); }
});
router.post("/restore", express.json({ limit: "15mb" }), async (req, res) => {
  try {
    const backup = req.body;
    if (backup?.format !== "libraflow-backup" || backup?.version !== 1 || !backup.data || !Array.isArray(backup.data.books) || !Array.isArray(backup.data.members) || !Array.isArray(backup.data.borrowRecords) || !Array.isArray(backup.data.notifications))
      return res.status(400).json({ message: "Invalid LibraFlow backup file." });
    if (req.body.confirmRestore !== true) return res.status(400).json({ message: "Set confirmRestore to true to confirm this destructive restore." });
    // Validate the complete payload before replacing any collection.
    const collections = [
      [Book, backup.data.books], [Member, backup.data.members], [BorrowRecord, backup.data.borrowRecords], [Notification, backup.data.notifications]
    ];
    for (const [Model, docs] of collections) {
      for (const doc of docs) { const candidate = new Model(doc); const error = candidate.validateSync(); if (error) return res.status(400).json({ message: `Backup validation failed for ${Model.modelName}: ${error.message}` }); }
    }
    for (const [Model, docs] of collections) {
      await Model.deleteMany({});
      if (docs.length) await Model.insertMany(docs, { ordered: true });
    }
    req.app.get("io")?.emit("library:update");
    res.json({ message: "Backup restored successfully. Please sign in again if your session changed." });
  } catch (error) { console.error("Backup restore:", error); res.status(500).json({ message: "Restore failed. Check that the backup belongs to this LibraFlow version." }); }
});
module.exports = router;
