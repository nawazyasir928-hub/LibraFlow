require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const bookRoutes = require("./routes/bookRoutes");
const memberRoutes = require("./routes/memberRoutes");
const borrowRoutes = require("./routes/borrowRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes"); // Existing route retained; no new inventory features added.
const notificationRoutes = require("./routes/notificationRoutes");
const reportRoutes = require("./routes/reportRoutes");
const backupRoutes = require("./routes/backupRoutes");

const app = express();
const server = http.createServer(app);
const allowedOrigins = ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://localhost:5176"];
const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin not allowed by CORS"));
  },
  credentials: true
};
app.use(cors(corsOptions));
app.use(express.json({ limit: "15mb" }));
const io = new Server(server, { cors: corsOptions });
app.set("io", io);
io.on("connection", socket => socket.on("disconnect", () => {}));

// Small in-memory login/register throttle. For multi-instance production use a shared store.
const authAttempts = new Map();
app.use("/api/auth", (req, res, next) => {
  if (!["POST"].includes(req.method) || !["/login", "/register"].includes(req.path)) return next();
  const key = `${req.ip}:${req.path}`;
  const now = Date.now();
  const entry = authAttempts.get(key) || { count: 0, resetAt: now + 15 * 60 * 1000 };
  if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + 15 * 60 * 1000; }
  entry.count += 1;
  authAttempts.set(key, entry);
  if (entry.count > 12) return res.status(429).json({ message: "Too many attempts. Please try again in 15 minutes." });
  next();
});

app.get("/", (req, res) => res.json({ message: "LibraFlow Backend is Running!" }));
app.get("/api/test", (req, res) => res.json({ message: "API routes are working!" }));
app.use("/api/auth", authRoutes);
app.use("/api/books", bookRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/borrow", borrowRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/backup", backupRoutes);
app.use((req, res) => res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` }));
app.use((err, req, res, next) => {
  console.error("Server error:", err.message);
  res.status(err.message === "Origin not allowed by CORS" ? 403 : 500).json({ message: err.message === "Origin not allowed by CORS" ? err.message : "An internal server error occurred." });
});
const PORT = process.env.PORT || 5000;
async function startServer() {
  try {
    await connectDB();
    server.listen(PORT, () => console.log(`LibraFlow backend running on port ${PORT}`));
  } catch (error) { console.error("Server startup failed:", error); }
}
startServer();
