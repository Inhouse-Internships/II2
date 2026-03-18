const mongoose = require("mongoose");

const programSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  departments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Department" }],
  duration: {
    type: Number,
    default: 4
  },
  eligibleYears: {
    type: [String],
    default: []
  }
}, { timestamps: true });

module.exports = mongoose.model("Program", programSchema);