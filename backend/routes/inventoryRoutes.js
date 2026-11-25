
const express = require("express");
const mongoose = require("mongoose");

const InventoryItem = require("../models/InventoryItem");
const InventoryTransaction = require("../models/InventoryTransaction");
const { protect, adminOnly } = require("../middleware/authMiddleware");

const router = express.Router();

// All inventory routes require an authenticated administrator
router.use(protect, adminOnly);

// Helper: validate MongoDB ID
const validId = (id) => mongoose.Types.ObjectId.isValid(id);

// Helper: error response
const handleError = (res, error) => {
  console.error("Inventory Error:", error.message);
  return res.status(500).json({
    message: "An inventory server error occurred.",
  });
};

// ==========================================
// 1. GET ALL INVENTORY ITEMS
// ==========================================
router.get("/", async (req, res) => {
  try {
    const {
      search,
      category,
      status,
      lowStock,
      page = 1,
      limit = 10,
    } = req.query;

    const filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { itemCode: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
        { assetTag: { $regex: search, $options: "i" } },
        { serialNumber: { $regex: search, $options: "i" } },
      ];
    }

    if (category) filter.category = category;
    if (status) filter.status = status;

    if (lowStock === "true") {
      filter.$expr = { $lte: ["$quantity", "$minimumStock"] };
    }

    const currentPage = Math.max(1, Number(page) || 1);
    const pageLimit = Math.min(100, Math.max(1, Number(limit) || 10));
    const skip = (currentPage - 1) * pageLimit;

    const [items, total] = await Promise.all([
      InventoryItem.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageLimit)
        .lean(),
      InventoryItem.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      items,
      pagination: {
        total,
        page: currentPage,
        limit: pageLimit,
        totalPages: Math.ceil(total / pageLimit),
      },
    });
  } catch (error) {
    handleError(res, error);
  }
});

// ==========================================
// 2. GET INVENTORY DASHBOARD SUMMARY
// ==========================================
router.get("/dashboard/summary", async (req, res) => {
  try {
    const summary = await InventoryItem.aggregate([
      {
        $group: {
          _id: null,
          totalItems: { $sum: 1 },
          totalQuantity: { $sum: "$quantity" },
          totalValue: {
            $sum: { $multiply: ["$quantity", "$purchasePrice"] },
          },
          lowStockItems: {
            $sum: {
              $cond: [
                { $lte: ["$quantity", "$minimumStock"] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    res.json({
      success: true,
      summary: summary[0] || {
        totalItems: 0,
        totalQuantity: 0,
        totalValue: 0,
        lowStockItems: 0,
      },
    });
  } catch (error) {
    handleError(res, error);
  }
});

// ==========================================
// 3. GET LOW STOCK ITEMS
// ==========================================
router.get("/alerts/low-stock", async (req, res) => {
  try {
    const items = await InventoryItem.find({
      $expr: { $lte: ["$quantity", "$minimumStock"] },
      status: "Active",
    }).sort({ quantity: 1 });

    res.json({
      success: true,
      count: items.length,
      items,
    });
  } catch (error) {
    handleError(res, error);
  }
});

// ==========================================
// 4. CREATE INVENTORY ITEM
// ==========================================
router.post("/", async (req, res) => {
  try {
    const {
      name,
      category,
      quantity,
      minimumStock,
      unit,
      purchasePrice,
      purchaseDate,
      invoiceNumber,
      supplierName,
      supplierContact,
      supplierEmail,
      assetTag,
      serialNumber,
      location,
      condition,
      description,
    } = req.body;

    if (!name || !category) {
      return res.status(400).json({
        message: "Item name and category are required.",
      });
    }

    const parsedQuantity = Number(quantity ?? 0);
    const parsedMinimumStock = Number(minimumStock ?? 0);
    const parsedPrice = Number(purchasePrice ?? 0);

    if (
      !Number.isFinite(parsedQuantity) ||
      !Number.isFinite(parsedMinimumStock) ||
      !Number.isFinite(parsedPrice) ||
      parsedQuantity < 0 ||
      parsedMinimumStock < 0 ||
      parsedPrice < 0
    ) {
      return res.status(400).json({
        message: "Quantity, minimum stock and price must be valid non-negative numbers.",
      });
    }

    const item = await InventoryItem.create({
      name,
      category,
      quantity: parsedQuantity,
      minimumStock: parsedMinimumStock,
      unit,
      purchasePrice: parsedPrice,
      purchaseDate,
      invoiceNumber,
      supplierName,
      supplierContact,
      supplierEmail,
      assetTag,
      serialNumber,
      location,
      condition,
      description,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: "Inventory item created successfully.",
      item,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Item code, asset tag or serial number already exists.",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: error.message,
      });
    }

    handleError(res, error);
  }
});

// ==========================================
// 5. GET SINGLE INVENTORY ITEM
// ==========================================
router.get("/:id", async (req, res) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({ message: "Invalid inventory item ID." });
    }

    const item = await InventoryItem.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: "Inventory item not found." });
    }

    res.json({ success: true, item });
  } catch (error) {
    handleError(res, error);
  }
});

// ==========================================
// 6. UPDATE INVENTORY ITEM DETAILS
// ==========================================
router.put("/:id", async (req, res) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({ message: "Invalid inventory item ID." });
    }

    const allowedFields = [
      "name",
      "category",
      "minimumStock",
      "unit",
      "purchasePrice",
      "purchaseDate",
      "invoiceNumber",
      "supplierName",
      "supplierContact",
      "supplierEmail",
      "assetTag",
      "serialNumber",
      "location",
      "condition",
      "status",
      "description",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (updates.minimumStock !== undefined) {
      updates.minimumStock = Number(updates.minimumStock);

      if (!Number.isFinite(updates.minimumStock) || updates.minimumStock < 0) {
        return res.status(400).json({
          message: "Minimum stock must be a non-negative number.",
        });
      }
    }

    if (updates.purchasePrice !== undefined) {
      updates.purchasePrice = Number(updates.purchasePrice);

      if (!Number.isFinite(updates.purchasePrice) || updates.purchasePrice < 0) {
        return res.status(400).json({
          message: "Purchase price must be a non-negative number.",
        });
      }
    }

    updates.updatedBy = req.user._id;

    const item = await InventoryItem.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!item) {
      return res.status(404).json({ message: "Inventory item not found." });
    }

    res.json({
      success: true,
      message: "Inventory item updated successfully.",
      item,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Asset tag or serial number already exists.",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }

    handleError(res, error);
  }
});

// ==========================================
// 7. STOCK MOVEMENT
// ==========================================
router.post("/:id/transactions", async (req, res) => {
  let item;
  let previousQuantity;
  let newQuantity;
  let quantityChange;
  let stockWasUpdated = false;

  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({ message: "Invalid inventory item ID." });
    }

    const {
      transactionType,
      quantity,
      unitPrice,
      referenceNumber,
      fromLocation,
      toLocation,
      notes,
    } = req.body;

    const allowedTypes = [
      "Stock In",
      "Stock Out",
      "Adjustment",
      "Damaged",
      "Transfer",
    ];

    if (!allowedTypes.includes(transactionType)) {
      return res.status(400).json({
        message: "Invalid stock transaction type.",
      });
    }

    const amount = Number(quantity);

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        message: "Quantity must be a positive number.",
      });
    }

    item = await InventoryItem.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: "Inventory item not found." });
    }

    previousQuantity = item.quantity;
    quantityChange = 0;

    if (transactionType === "Stock In") {
      quantityChange = amount;
    }

    if (
      transactionType === "Stock Out" ||
      transactionType === "Damaged"
    ) {
      quantityChange = -amount;
    }

    if (transactionType === "Adjustment") {
      const adjustment = Number(req.body.adjustment);

      if (!Number.isFinite(adjustment) || adjustment === 0) {
        return res.status(400).json({
          message: "For adjustment, provide a non-zero adjustment value.",
        });
      }

      if (Math.abs(adjustment) !== amount) {
        return res.status(400).json({
          message: "Quantity must match the absolute adjustment value.",
        });
      }

      quantityChange = adjustment;
    }

    if (transactionType === "Transfer") {
      if (!toLocation) {
        return res.status(400).json({
          message: "Destination location is required for a transfer.",
        });
      }

      if (fromLocation && fromLocation !== item.location) {
        return res.status(400).json({
          message: "Source location does not match the item's current location.",
        });
      }
    }

    newQuantity = previousQuantity + quantityChange;

    if (newQuantity < 0) {
      return res.status(400).json({
        message: "Insufficient stock. Inventory cannot become negative.",
      });
    }

    // Conditional update prevents stock from going below zero.
    // Transfer changes location but does not change total quantity.
    const update = {
      $set: {
        updatedBy: req.user._id,
      },
    };

    if (transactionType === "Transfer") {
      update.$set.location = toLocation;
    } else if (quantityChange !== 0) {
      update.$inc = { quantity: quantityChange };
    }

    const conditions = { _id: item._id };

    if (quantityChange < 0) {
      conditions.quantity = { $gte: amount };
    } else {
      conditions.quantity = previousQuantity;
    }

    const updatedItem = await InventoryItem.findOneAndUpdate(
      conditions,
      update,
      { new: true, runValidators: true }
    );

    if (!updatedItem) {
      return res.status(409).json({
        message: "Stock changed during this request. Refresh and try again.",
      });
    }

    stockWasUpdated = true;
    newQuantity = updatedItem.quantity;

    const transaction = await InventoryTransaction.create({
      inventoryItem: item._id,
      transactionType,
      quantity: amount,
      previousQuantity,
      newQuantity,
      unitPrice: Number(unitPrice) || 0,
      referenceNumber,
      fromLocation: fromLocation || item.location,
      toLocation,
      performedBy: req.user._id,
      notes,
    });

    res.status(201).json({
      success: true,
      message: "Stock transaction recorded successfully.",
      item: updatedItem,
      transaction,
    });
  } catch (error) {
    // Best-effort compensation if transaction creation fails.
    // For strict multi-document atomicity, use a MongoDB replica set
    // and a database transaction.
    if (stockWasUpdated && item) {
      try {
        const rollback = {
          $set: { quantity: previousQuantity },
        };

        if (req.body.transactionType === "Transfer") {
          rollback.$set.location = item.location;
        }

        await InventoryItem.updateOne(
          {
            _id: item._id,
            quantity: newQuantity,
          },
          rollback
        );
      } catch (rollbackError) {
        console.error("Inventory rollback failed:", rollbackError.message);
      }
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }

    handleError(res, error);
  }
});

// ==========================================
// 8. GET ITEM TRANSACTION HISTORY
// ==========================================
router.get("/:id/transactions", async (req, res) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({ message: "Invalid inventory item ID." });
    }

    const itemExists = await InventoryItem.exists({ _id: req.params.id });

    if (!itemExists) {
      return res.status(404).json({ message: "Inventory item not found." });
    }

    const transactions = await InventoryTransaction.find({
      inventoryItem: req.params.id,
    })
      .populate("performedBy", "name email")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: transactions.length,
      transactions,
    });
  } catch (error) {
    handleError(res, error);
  }
});

// ==========================================
// 9. DELETE INVENTORY ITEM
// ==========================================
router.delete("/:id", async (req, res) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({ message: "Invalid inventory item ID." });
    }

    const item = await InventoryItem.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: "Inventory item not found." });
    }

    const hasTransactions = await InventoryTransaction.exists({
      inventoryItem: item._id,
    });

    if (hasTransactions) {
      return res.status(409).json({
        message: "This item has stock history. Mark it inactive instead of deleting it.",
      });
    }

    await InventoryItem.deleteOne({ _id: item._id });

    res.json({
      success: true,
      message: "Inventory item deleted successfully.",
    });
  } catch (error) {
    handleError(res, error);
  }
});

module.exports = router;
