
require("dotenv").config();

const mongoose = require("mongoose");
const Member = require("./models/Member");

async function createAdmin() {
  try {
    await mongoose.connect(
      process.env.MONGO_URI || "mongodb://127.0.0.1:27017/LibraryManagementDB"
    );

    const email = "admin@libraflow.com";
    const password = "admin123";

    let admin = await Member.findOne({ email }).select("+password");

    if (admin) {
      admin.name = "Administrator";
      admin.password = password;
      admin.role = "admin";
      admin.approvalStatus = "Approved";
      admin.status = "Active";
      await admin.save();

      console.log("Existing admin account updated successfully!");
    } else {
      await Member.create({
        name: "Administrator",
        email,
        phone: "03000000000",
        address: "Library Administration",
        password,
        role: "admin",
        approvalStatus: "Approved",
        status: "Active"
      });

      console.log("Admin account created successfully!");
    }

    console.log("Email:", email);
    console.log("Password:", password);
  } catch (error) {
    console.error("Admin setup failed:", error.message);
  } finally {
    await mongoose.disconnect();
  }
}

createAdmin();
