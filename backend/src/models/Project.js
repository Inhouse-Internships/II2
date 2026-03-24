const mongoose = require('mongoose');
const { PROJECT_STATUS } = require('../utils/constants');
const AppError = require('../utils/appError');

const projectSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    projectId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true
    },
    baseDept: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department'
    },
    description: { type: String, trim: true },
    guide: { type: String, trim: true },
    guideEmpId: { type: String, trim: true },
    guideDept: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
    coGuide: { type: String, trim: true },
    coGuideEmpId: { type: String, trim: true },
    coGuideDept: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
    skillsRequired: { type: String, trim: true },
    projectOutcome: { type: String, trim: true },
    teamLeader: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    departments: [
      {
        department: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Department'
        },
        seats: {
          type: Number,
          default: 0,
          min: 0
        }
      }
    ],
    autoAssignDepartments: {
      type: Boolean,
      default: false
    },
    status: {
      type: String,
      enum: Object.values(PROJECT_STATUS),
      default: PROJECT_STATUS.OPEN
    },
    allowWithdrawal: {
      type: Boolean,
      default: true
    },
    tasksVisibleFromDate: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

projectSchema.virtual('totalSeats').get(function totalSeatsGetter() {
  if (!this.departments) return 0;
  return this.departments.reduce((sum, entry) => sum + (entry.seats || 0), 0);
});

projectSchema.set('toJSON', { virtuals: true });
projectSchema.set('toObject', { virtuals: true });

projectSchema.statics.generateProjectId = async function (baseDept) {
  if (!baseDept) throw new AppError(400, "Base Department is required to generate Project ID");

  // Dynamic import or rely on model cache
  const Setting = mongoose.model('Setting');
  const { SETTING_KEYS } = require('../utils/constants');

  // 1. Get Internship Year (Default to current year)
  let year = new Date().getFullYear();
  try {
    const startDateSetting = await Setting.findOne({ key: SETTING_KEYS.INTERNSHIP_START_DATE }).lean();
    if (startDateSetting && startDateSetting.value) {
      const d = new Date(startDateSetting.value);
      if (!isNaN(d.getTime())) {
        year = d.getFullYear();
      }
    }
  } catch (err) {
    console.error("Failed to fetch internship year setting", err);
  }
  const yearStr = year.toString().slice(-2); // e.g., "26"

  // 2. Base Dept first two letters in capital
  // e.g., "Computer Science" -> "CO", "CSE" -> "CS"
  let baseDeptName = baseDept;
  if (mongoose.Types.ObjectId.isValid(baseDept)) {
    const Department = mongoose.model('Department');
    const dept = await Department.findById(baseDept).lean();
    if (dept && dept.name) {
      baseDeptName = dept.name;
    }
  }

  const deptCode = baseDeptName.toUpperCase().replace(/[^A-Z]/g, '').substring(0, 2);

  const prefix = `${yearStr}${deptCode}`; // "26CS"
  const prefixRegex = new RegExp(`^${prefix}(\\d+)$`);

  // 3. Auto-given Serial Number
  const projects = await this.find({ projectId: new RegExp(`^${prefix}`) })
    .select('projectId')
    .lean();

  let maxNumber = 0;
  for (const p of projects) {
    if (!p.projectId) continue;
    const match = p.projectId.match(prefixRegex);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNumber) maxNumber = num;
    }
  }

  const serialNum = maxNumber + 1;
  const serial = serialNum.toString().padStart(3, '0');

  return `${prefix}${serial}`;
};

projectSchema.index({ baseDept: 1, status: 1 });

module.exports = mongoose.model('Project', projectSchema);

