
const mongoose = require("mongoose");

const bookSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  author: {
    type: String,
    required: true,
    trim: true
  },
  isbn: {
    type: String,
    required: true,
    unique: true
  },
  category: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  availableCopies: {
    type: Number,
    required: true,
    min: 0
  },
  coverUrl: { type: String, default: "" },
  ebookUrl: { type: String, default: "" },
  ebookFormat: { type: String, default: "" },
  source: { type: String, default: "" },
  isPublicDomain: { type: Boolean, default: false }
}, {
  timestamps: true
});

module.exports = mongoose.model("Book", bookSchema);
