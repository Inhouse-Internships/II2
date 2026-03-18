const mongoose = require("mongoose");

const departmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  program: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Program"
  }
});

module.exports = mongoose.model("Department", departmentSchema);