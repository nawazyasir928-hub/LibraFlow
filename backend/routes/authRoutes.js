
const express = require("express");
const jwt = require("jsonwebtoken");
const Member = require("../models/Member");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

const createToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

// Register a new library member
router.post("/register", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: "Please complete all required fields." });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must contain at least 6 characters." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingMember = await Member.findOne({ email: normalizedEmail });

    if (existingMember) {
      return res.status(409).json({ message: "This email is already registered." });
    }

    const member = await Member.create({
      name: name.trim(),
      email: normalizedEmail,
      phone: phone.trim(),
      password,
      role: "member",
      approvalStatus: "Pending",
      status: "Active"
    });

    res.status(201).json({
      message: "Registration submitted. Please wait for administrator approval.",
      user: member
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const user = await Member.findOne({
      email: email.trim().toLowerCase()
    }).select("+password");

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    if (user.status !== "Active") {
      return res.status(403).json({ message: "Your account is inactive." });
    }

    if (user.role === "member" && user.approvalStatus !== "Approved") {
      return res.status(403).json({
        message: user.approvalStatus === "Rejected"
          ? "Your registration was rejected. Contact the administrator."
          : "Your account is waiting for administrator approval."
      });
    }

    res.json({
      token: createToken(user._id),
      user: user.toJSON()
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get logged-in user
router.get("/me", protect, (req, res) => {
  res.json({ user: req.user });
});

// Change password
router.put("/change-password", protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return res.status(400).json({
        message: "Enter your current password and a new password of at least 6 characters."
      });
    }

    const user = await Member.findById(req.user._id).select("+password");

    if (!user || !(await user.comparePassword(currentPassword))) {
      return res.status(400).json({ message: "Current password is incorrect." });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: "Password changed successfully." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
