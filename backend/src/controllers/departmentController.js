const Department = require('../models/Department');

const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/appError');
const { successResponse } = require('../utils/response');

const getAllDepartments = asyncHandler(async (req, res) => {
  const departments = await Department.find().sort({ name: 1 }).lean();
  return successResponse(res, departments);
});

const createDepartment = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name || !String(name).trim()) {
    throw new AppError(400, 'Department name is required');
  }

  const department = await Department.create({ name: String(name).trim() });
  return successResponse(res, department, 'Department created', 201);
});

const updateDepartment = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name || !String(name).trim()) {
    throw new AppError(400, 'Department name is required');
  }

  const department = await Department.findByIdAndUpdate(
    req.params.id,
    { name: String(name).trim() },
    { new: true }
  );

  if (!department) {
    throw new AppError(404, 'Department not found');
  }

  return successResponse(res, department, 'Department updated');
});

const deleteDepartment = asyncHandler(async (req, res) => {
  const department = await Department.findByIdAndDelete(req.params.id);
  if (!department) {
    throw new AppError(404, 'Department not found');
  }

  return successResponse(res, {}, 'Department deleted');
});

module.exports = {
  getAllDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment
};

