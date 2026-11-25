
const mongoose = require("mongoose");

const inventoryTransactionSchema = new mongoose.Schema(
  {
    // Related Inventory Item
    inventoryItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InventoryItem",
      required: true,
      index: true,
    },

    // Transaction Information
    transactionType: {
      type: String,
      required: true,
      enum: [
        "Stock In",
        "Stock Out",
        "Adjustment",
        "Damaged",
        "Transfer",
        "Department Issue",
        "Department Return",
        "Write Off",
      ],
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isInteger,
    },

    previousQuantity: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isInteger,
    },

    newQuantity: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isInteger,
    },

    // Financial Information
    unitPrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalPrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    referenceNumber: {
      type: String,
      trim: true,
      default: "",
      maxlength: 100,
    },

    invoiceNumber: {
      type: String,
      trim: true,
      default: "",
      maxlength: 100,
    },

    // Location Transfer
    fromLocation: {
      type: String,
      trim: true,
      default: "",
      maxlength: 100,
    },

    toLocation: {
      type: String,
      trim: true,
      default: "",
      maxlength: 100,
    },

    // Department Allocation
    department: {
      type: String,
      trim: true,
      default: "",
      maxlength: 100,
    },

    issuedTo: {
      type: String,
      trim: true,
      default: "",
      maxlength: 100,
    },

    // Supplier Information
    supplierName: {
      type: String,
      trim: true,
      default: "",
      maxlength: 100,
    },

    // Approval Workflow
    approvalRequired: {
      type: Boolean,
      default: false,
    },

    approvalStatus: {
      type: String,
      enum: ["Not Required", "Pending", "Approved", "Rejected"],
      default: "Not Required",
    },

    approvalRequestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      default: null,
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      default: null,
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    approvalNotes: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },

    // User and Audit Information
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: true,
    },

    action: {
      type: String,
      enum: [
        "Created",
        "Updated",
        "Stock Movement",
        "Approved",
        "Rejected",
        "Deleted",
        "Maintenance",
      ],
      default: "Stock Movement",
    },

    reason: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },

    notes: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
  }
);

// History and Reporting Indexes
inventoryTransactionSchema.index({ inventoryItem: 1, createdAt: -1 });
inventoryTransactionSchema.index({ createdAt: -1 });
inventoryTransactionSchema.index({ transactionType: 1 });
inventoryTransactionSchema.index({ performedBy: 1 });
inventoryTransactionSchema.index({ department: 1 });
inventoryTransactionSchema.index({ approvalStatus: 1 });
inventoryTransactionSchema.index({ referenceNumber: 1 });

// Export Model
module.exports = mongoose.model(
  "InventoryTransaction",
  inventoryTransactionSchema
);
