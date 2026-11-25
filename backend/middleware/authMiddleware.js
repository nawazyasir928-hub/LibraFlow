
const jwt = require("jsonwebtoken");
const Member = require("../models/Member");

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authentication required." });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await Member.findById(decoded.id);

    if (!user || user.status !== "Active") {
      return res.status(401).json({ message: "Account not available." });
    }

    if (user.role === "member" && user.approvalStatus !== "Approved") {
      return res.status(403).json({ message: "Your account is awaiting approval." });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired login session." });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    return next();
  }

  return res.status(403).json({ message: "Administrator access required." });
};

module.exports = { protect, adminOnly };
