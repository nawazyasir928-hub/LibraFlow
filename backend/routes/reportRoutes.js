const express = require("express");
const BorrowRecord = require("../models/BorrowRecord");
const Book = require("../models/Book");
const Member = require("../models/Member");
const { protect, adminOnly } = require("../middleware/authMiddleware");
const router = express.Router();
router.get("/summary", protect, adminOnly, async (req, res) => {
  try {
    const { from, to } = req.query;
    const dateFilter = {};
    if (from || to) dateFilter.createdAt = {};
    if (from && !Number.isNaN(Date.parse(from))) dateFilter.createdAt.$gte = new Date(from);
    if (to && !Number.isNaN(Date.parse(to))) { const end = new Date(to); end.setHours(23, 59, 59, 999); dateFilter.createdAt.$lte = end; }
    const [bookCount, memberCount, activeMembers, borrowCount, activeLoans, overdueLoans, categoryBreakdown, monthlyTrend, topBooks] = await Promise.all([
      Book.countDocuments(), Member.countDocuments({ role: "member" }), Member.countDocuments({ role: "member", status: "Active", approvalStatus: "Approved" }),
      BorrowRecord.countDocuments(dateFilter), BorrowRecord.countDocuments({ status: { $ne: "Returned" } }),
      BorrowRecord.countDocuments({ status: { $ne: "Returned" }, dueDate: { $lt: new Date() } }),
      Book.aggregate([{ $group: { _id: "$category", titles: { $sum: 1 }, copies: { $sum: "$quantity" }, available: { $sum: "$availableCopies" } } }, { $sort: { copies: -1 } }]),
      BorrowRecord.aggregate([{ $match: dateFilter }, { $group: { _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } }, count: { $sum: 1 } } }, { $sort: { "_id.year": 1, "_id.month": 1 } }]),
      BorrowRecord.aggregate([{ $group: { _id: "$book", borrowCount: { $sum: 1 } } }, { $sort: { borrowCount: -1 } }, { $limit: 5 }, { $lookup: { from: "books", localField: "_id", foreignField: "_id", as: "book" } }, { $unwind: "$book" }, { $project: { _id: 0, title: "$book.title", author: "$book.author", borrowCount: 1 } }])
    ]);
    res.json({ generatedAt: new Date(), totals: { bookTitles: bookCount, members: memberCount, activeMembers, borrowTransactions: borrowCount, activeLoans, overdueLoans }, categoryBreakdown, monthlyTrend, topBooks });
  } catch (error) { console.error("Report summary:", error); res.status(500).json({ message: "Could not generate reports." }); }
});
module.exports = router;
