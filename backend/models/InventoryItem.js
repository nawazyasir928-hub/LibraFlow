
const mongoose = require("mongoose");
const { randomUUID } = require("crypto");

const inventoryItemSchema = new mongoose.Schema(
  {
    // Unique Inventory Identification
    itemCode: {
      type: String,
      unique: true,
      immutable: true,
      default: () => `INV-${randomUUID().slice(0, 8).toUpperCase()}`,
    },

    name: {
      type: String,
      required: [true, "Item name is required"],
      trim: true,
      minlength: 2,
      maxlength: 100,
    },

    category: {
      type: String,
      required: true,
      enum: [
        "Furniture",
        "Electronics",
        "Stationery",
        "Equipment",
        "Cleaning Supplies",
        "Other",
      ],
    },

    quantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: Number.isInteger,
    },

    minimumStock: {
      type: Number,
      default: 5,
      min: 0,
      validate: Number.isInteger,
    },

    unit: {
      type: String,
      trim: true,
      default: "Piece",
      maxlength: 30,
    },

    // Purchase Information
    purchasePrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    purchaseDate: {
      type: Date,
      default: null,
    },

    invoiceNumber: {
      type: String,
      trim: true,
      default: "",
      maxlength: 80,
    },

    // Supplier Information
    supplierName: {
      type: String,
      trim: true,
      default: "",
      maxlength: 100,
    },

    supplierContact: {
      type: String,
      trim: true,
      default: "",
      maxlength: 30,
    },

    supplierEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      maxlength: 120,
    },

    // Asset Identification
    assetTag: {
      type: String,
      trim: true,
      uppercase: true,
      default: undefined,
    },

    serialNumber: {
      type: String,
      trim: true,
      default: undefined,
      maxlength: 100,
    },

    // Warranty Tracking
    warrantyExpiry: {
      type: Date,
      default: null,
    },

    warrantyTerms: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },

    // Expiry Tracking (for consumable supplies)
    expiryDate: {
      type: Date,
      default: null,
    },

    // Department Allocation
    department: {
      type: String,
      trim: true,
      default: "",
      maxlength: 100,
    },

    allocatedTo: {
      type: String,
      trim: true,
      default: "",
      maxlength: 100,
    },

    allocationDate: {
      type: Date,
      default: null,
    },

    // Storage and Condition
    location: {
      type: String,
      trim: true,
      default: "",
      maxlength: 100,
    },

    condition: {
      type: String,
      enum: ["New", "Good", "Fair", "Damaged"],
      default: "Good",
    },

    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
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

    // Additional Information
    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },

    lastRestockedAt: {
      type: Date,
      default: null,
    },

    // User Tracking
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      default: null,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Low Stock Status
inventoryItemSchema.virtual("isLowStock").get(function () {
  return this.quantity <= this.minimumStock;
});

// Total Inventory Value
inventoryItemSchema.virtual("totalValue").get(function () {
  return this.quantity * this.purchasePrice;
});

// Expiry Status
inventoryItemSchema.virtual("isExpired").get(function () {
  return this.expiryDate
    ? this.expiryDate < new Date()
    : false;
});

// Warranty Status
inventoryItemSchema.virtual("warrantyExpired").get(function () {
  return this.warrantyExpiry
    ? this.warrantyExpiry < new Date()
    : false;
});

// Database Indexes
inventoryItemSchema.index({ name: 1 });
inventoryItemSchema.index({ category: 1 });
inventoryItemSchema.index({ status: 1 });
inventoryItemSchema.index({ quantity: 1 });
inventoryItemSchema.index({ expiryDate: 1 });
inventoryItemSchema.index({ warrantyExpiry: 1 });
inventoryItemSchema.index({ department: 1 });
inventoryItemSchema.index({ approvalStatus: 1 });

inventoryItemSchema.index(
  { assetTag: 1 },
  {
    unique: true,
    partialFilterExpression: {
      assetTag: { $type: "string" },
    },
  }
);

inventoryItemSchema.index(
  { serialNumber: 1 },
  {
    unique: true,
    partialFilterExpression: {
      serialNumber: { $type: "string" },
    },
  }
);

module.exports = mongoose.model(
  "InventoryItem",
  inventoryItemSchema
);
