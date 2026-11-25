const express = require("express");
const mongoose = require("mongoose");
const Book = require("../models/Book");
const { protect, adminOnly } = require("../middleware/authMiddleware");
const router = express.Router();

// Public catalogue with search, filters, sorting and pagination.
router.get("/", async (req, res) => {
  try {
    const { search = "", category, author, available, sort = "title", page = 1, limit = 100 } = req.query;
    const filter = {};
    if (search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      filter.$or = [{ title: regex }, { author: regex }, { isbn: regex }, { category: regex }];
    }
    if (category && category !== "All") filter.category = category;
    if (author) filter.author = new RegExp(author.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    if (available === "true") filter.availableCopies = { $gt: 0 };
    if (available === "false") filter.availableCopies = 0;
    const allowedSort = { title: "title", author: "author", newest: "-createdAt", oldest: "createdAt", available: "-availableCopies" };
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(1000, Math.max(1, parseInt(limit, 10) || 100));
    const [books, total] = await Promise.all([
      Book.find(filter).select("-ebookUrl").sort(allowedSort[sort] || "title").skip((pageNum - 1) * limitNum).limit(limitNum),
      Book.countDocuments(filter)
    ]);
    const hasAdvancedQuery = Boolean(search || category || author || available || req.query.sort || req.query.page || req.query.limit);
    res.json(hasAdvancedQuery ? { books, total, page: pageNum, pages: Math.ceil(total / limitNum) } : books);
  } catch (error) { res.status(500).json({ message: "Failed to fetch books." }); }
});

// E-book links are disclosed only after server-side authentication.
router.get("/:id/read", protect, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid book ID." });
    const book = await Book.findById(req.params.id).select("title ebookUrl ebookFormat isPublicDomain");
    if (!book) return res.status(404).json({ message: "Book not found." });
    if (!book.ebookUrl || !book.isPublicDomain) return res.status(404).json({ message: "No legally accessible e-book is available for this title." });
    res.json({ title: book.title, url: book.ebookUrl, format: book.ebookFormat || "Online" });
  } catch { res.status(500).json({ message: "Unable to open this e-book." }); }
});

router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid book ID." });
    const book = await Book.findById(req.params.id).select("-ebookUrl");
    if (!book) return res.status(404).json({ message: "Book not found." });
    res.json(book);
  } catch { res.status(500).json({ message: "Failed to fetch book." }); }
});

router.post("/", protect, adminOnly, async (req, res) => {
  try {
    const { title, author, isbn, category, quantity, availableCopies, coverUrl, ebookUrl, ebookFormat, source, isPublicDomain } = req.body;
    if (!title || !author || !isbn || !category || quantity === undefined || availableCopies === undefined)
      return res.status(400).json({ message: "Complete all required book fields." });
    if (!Number.isInteger(Number(quantity)) || !Number.isInteger(Number(availableCopies)) || Number(quantity) < 0 || Number(availableCopies) < 0 || Number(availableCopies) > Number(quantity))
      return res.status(400).json({ message: "Book quantities must be valid whole numbers; available copies cannot exceed total quantity." });
    const book = await Book.create({ title, author, isbn, category, quantity, availableCopies, coverUrl, ebookUrl, ebookFormat, source, isPublicDomain });
    req.app.get("io")?.emit("library:update");
    res.status(201).json(book);
  } catch (error) { res.status(400).json({ message: error.code === 11000 ? "This ISBN is already registered." : error.message }); }
});

router.put("/:id", protect, adminOnly, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid book ID." });
    const allowed = ["title", "author", "isbn", "category", "quantity", "availableCopies", "coverUrl", "ebookUrl", "ebookFormat", "source", "isPublicDomain"];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
    if (updates.quantity !== undefined && (!Number.isInteger(Number(updates.quantity)) || Number(updates.quantity) < 0)) return res.status(400).json({ message: "Quantity must be a non-negative whole number." });
    if (updates.availableCopies !== undefined && (!Number.isInteger(Number(updates.availableCopies)) || Number(updates.availableCopies) < 0)) return res.status(400).json({ message: "Available copies must be a non-negative whole number." });
    const current = await Book.findById(req.params.id);
    if (!current) return res.status(404).json({ message: "Book not found." });
    const nextQuantity = updates.quantity ?? current.quantity;
    const nextAvailable = updates.availableCopies ?? current.availableCopies;
    if (nextAvailable > nextQuantity) return res.status(400).json({ message: "Available copies cannot exceed total quantity." });
    const updated = await Book.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    req.app.get("io")?.emit("library:update");
    res.json(updated);
  } catch (error) { res.status(400).json({ message: error.code === 11000 ? "This ISBN is already registered." : error.message }); }
});

router.delete("/:id", protect, adminOnly, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid book ID." });
    const deleted = await Book.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Book not found." });
    req.app.get("io")?.emit("library:update");
    res.json({ message: "Book deleted successfully." });
  } catch (error) { res.status(400).json({ message: error.message }); }
});
module.exports = router;
