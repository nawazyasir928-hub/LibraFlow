require("dotenv").config();
const mongoose = require("mongoose");
const Book = require("./models/Book");

const API = "https://gutendex.com/books/";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function firstSubject(subjects = []) {
  const raw = subjects.find((s) => !/--|fiction|juvenile|accessible/i.test(s)) || subjects[0] || "General Literature";
  return String(raw).split("--")[0].trim().slice(0, 80) || "General Literature";
}

async function fetchBooks() {
  const collected = new Map();
  let url = `${API}?page=1`;
  while (url && collected.size < 1000) {
    const response = await fetch(url, { headers: { "User-Agent": "LibraFlowLibrary/1.0 (public-domain catalogue import)" } });
    if (!response.ok) throw new Error(`Gutendex request failed: ${response.status}`);
    const data = await response.json();
    for (const item of data.results || []) {
      const author = (item.authors || []).map((a) => a.name).filter(Boolean).join(", ") || "Unknown author";
      const formats = item.formats || {};
      const ebookUrl = formats["text/html"] || formats["text/html; charset=utf-8"] || formats["text/plain; charset=utf-8"] || formats["text/plain"] || "";
      if (!ebookUrl) continue;
      collected.set(item.id, {
        title: String(item.title || `Project Gutenberg Book ${item.id}`).trim(),
        author,
        isbn: `PG-${item.id}`,
        category: firstSubject(item.subjects),
        quantity: 1,
        availableCopies: 1,
        coverUrl: `https://www.gutenberg.org/cache/epub/${item.id}/pg${item.id}.cover.medium.jpg`,
        ebookUrl,
        ebookFormat: ebookUrl.includes("text/html") ? "HTML" : "Text",
        source: "Project Gutenberg / Gutendex",
        isPublicDomain: true,
      });
      if (collected.size >= 1000) break;
    }
    url = data.next;
    await sleep(180);
  }
  return [...collected.values()];
}

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/LibraryManagementDB");
    console.log("Connected to LibraFlow database. Fetching public-domain catalogue...");
    const books = await fetchBooks();
    let added = 0, existing = 0;
    for (const book of books) {
      const result = await Book.updateOne({ isbn: book.isbn }, { $setOnInsert: book }, { upsert: true });
      if (result.upsertedCount) added++;
      else existing++;
    }
    console.log(`Catalogue import complete. Available records fetched: ${books.length}; inserted: ${added}; already present: ${existing}.`);
    console.log("Source: Project Gutenberg metadata via Gutendex. Full-text links are public-domain links; covers may fall back if a source image is unavailable.");
  } catch (error) {
    console.error("Catalogue import failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
