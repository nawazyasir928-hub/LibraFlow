
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const BorrowRecord = require("../models/BorrowRecord");
const Book = require("../models/Book");
const Member = require("../models/Member");
const { protect, adminOnly } = require("../middleware/authMiddleware");

// GET borrowing records
// Admin can see all records; members can see their own records.
router.get("/", protect, async (req, res) => {
  try {
    const filter =
      req.user.role === "admin"
        ? {}
        : { member: req.user._id };

    const records = await BorrowRecord.find(filter)
      .populate("book")
      .populate("member")
      .sort({ createdAt: -1 });

    res.status(200).json(records);
  } catch (error) {
    console.error("Fetch borrowing records:", error);
    res.status(500).json({
      message: "Failed to fetch borrowing records.",
    });
  }
});

// GET single borrowing record
router.get("/:id", protect, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid borrowing record ID.",
      });
    }

    const record = await BorrowRecord.findById(req.params.id)
      .populate("book")
      .populate("member");

    if (!record) {
      return res.status(404).json({
        message: "Borrowing record not found.",
      });
    }

    if (
      req.user.role !== "admin" &&
      record.member._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        message: "You are not allowed to view this record.",
      });
    }

    res.status(200).json(record);
  } catch (error) {
    console.error("Fetch borrowing record:", error);
    res.status(500).json({
      message: "Failed to fetch borrowing record.",
    });
  }
});

// ISSUE A BOOK - Admin only
router.post("/", protect, adminOnly, async (req, res) => {
  let stockReserved = false;
  let bookId;

  try {
    const { bookId: requestedBookId, memberId, dueDate } = req.body;

    if (
      !mongoose.isValidObjectId(requestedBookId) ||
      !mongoose.isValidObjectId(memberId)
    ) {
      return res.status(400).json({
        message: "Valid book and member IDs are required.",
      });
    }

    bookId = requestedBookId;

    if (!dueDate || Number.isNaN(Date.parse(dueDate))) {
      return res.status(400).json({
        message: "A valid due date is required.",
      });
    }

    if (new Date(dueDate) <= new Date()) {
      return res.status(400).json({
        message: "Due date must be in the future.",
      });
    }

    const member = await Member.findById(memberId);

    if (!member) {
      return res.status(404).json({
        message: "Member not found.",
      });
    }

    if (
      member.status !== "Active" ||
      member.approvalStatus !== "Approved"
    ) {
      return res.status(400).json({
        message: "Only active and approved members can borrow books.",
      });
    }

    // Atomically reserve one available copy.
    const book = await Book.findOneAndUpdate(
      {
        _id: bookId,
        availableCopies: { $gt: 0 },
      },
      {
        $inc: { availableCopies: -1 },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!book) {
      const existingBook = await Book.findById(bookId);

      if (!existingBook) {
        return res.status(404).json({
          message: "Book not found.",
        });
      }

      return res.status(400).json({
        message: "No copies are currently available.",
      });
    }

    stockReserved = true;

    const record = await BorrowRecord.create({
      book: bookId,
      member: memberId,
      dueDate: new Date(dueDate),
    });

    stockReserved = false;

    const populatedRecord = await BorrowRecord.findById(record._id)
      .populate("book")
      .populate("member");

    return res.status(201).json(populatedRecord);
  } catch (error) {
    // Restore stock if record creation fails.
    if (stockReserved && bookId) {
      await Book.findByIdAndUpdate(bookId, {
        $inc: { availableCopies: 1 },
      }).catch((rollbackError) => {
        console.error("Stock rollback failed:", rollbackError);
      });
    }

    console.error("Issue book error:", error);

    return res.status(500).json({
      message: "Failed to issue book. Please try again.",
    });
  }
});

// RETURN A BOOK - Admin only
router.put("/:id/return", protect, adminOnly, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid borrowing record ID.",
      });
    }

    const record = await BorrowRecord.findOneAndUpdate(
      {
        _id: req.params.id,
        status: { $ne: "Returned" },
      },
      {
        $set: {
          status: "Returned",
          returnDate: new Date(),
        },
      },
      {
        new: true,
      }
    );

    if (!record) {
      const existingRecord = await BorrowRecord.findById(req.params.id);

      if (!existingRecord) {
        return res.status(404).json({
          message: "Borrowing record not found.",
        });
      }

      return res.status(400).json({
        message: "This book has already been returned.",
      });
    }

    const book = await Book.findByIdAndUpdate(
      record.book,
      {
        $inc: { availableCopies: 1 },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!book) {
      // Restore record status if its book is unexpectedly missing.
      await BorrowRecord.findByIdAndUpdate(record._id, {
        $set: {
          status: "Borrowed",
          returnDate: null,
        },
      });

      return res.status(404).json({
        message: "Book not found. Return operation was cancelled.",
      });
    }

    const populatedRecord = await BorrowRecord.findById(record._id)
      .populate("book")
      .populate("member");

    return res.status(200).json({
      message: "Book returned successfully.",
      record: populatedRecord,
    });
  } catch (error) {
    console.error("Return book error:", error);

    return res.status(500).json({
      message: "Failed to return book. Please try again.",
    });
  }
});

// DELETE borrowing record - Admin only
router.delete("/:id", protect, adminOnly, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid borrowing record ID.",
      });
    }

    const record = await BorrowRecord.findById(req.params.id);

    if (!record) {
      return res.status(404).json({
        message: "Borrowing record not found.",
      });
    }

    if (record.status !== "Returned") {
      return res.status(400).json({
        message: "An active borrowing record cannot be deleted. Return the book first.",
      });
    }

    await BorrowRecord.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      message: "Borrowing record deleted successfully.",
    });
  } catch (error) {
    console.error("Delete borrowing record:", error);

    return res.status(500).json({
      message: "Failed to delete borrowing record.",
    });
  }
});

module.exports = router;
