const mongoose = require('mongoose');
const { ROLES, USER_STATUS } = require('../utils/constants');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true },
    phone: { type: String, trim: true },
    password: { type: String, required: true, select: false },

    studentId: { type: String, unique: true, sparse: true, uppercase: true, trim: true },
    employeeId: { type: String, unique: true, sparse: true, trim: true },

    department: { type: String, trim: true },
    year: { type: String, trim: true },
    program: { type: String, trim: true },

    role: { type: String, enum: Object.values(ROLES), default: ROLES.STUDENT },
    status: { type: String, enum: Object.values(USER_STATUS), default: USER_STATUS.PENDING },

    appliedProject: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    requestedProject: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    projectApplications: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }],

    applications: [
      {
        project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
        status: { type: String, enum: ['Pending', 'Qualified', 'Rejected'], default: 'Pending' },
        interviewNote: String,
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        updatedAt: { type: Date, default: Date.now }
      }
    ],

    coGuidedProject: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    requestedCoGuideProject: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    coGuideStatus: {
      type: String,
      enum: Object.values(USER_STATUS),
      default: USER_STATUS.PENDING
    },

    guide: { type: String, trim: true },
    guideDept: { type: String, trim: true },
    coGuide: { type: String, trim: true },
    coGuideDept: { type: String, trim: true },
    level: { type: Number, default: 1, min: 1 },

    // FIX: Token invalidation support — increment this to revoke all issued JWTs
    tokenVersion: { type: Number, default: 0, select: false }
  },
  { timestamps: true }
);

// ── Indexes ──────────────────────────────────────────────────────────────────
userSchema.index({ role: 1, department: 1, status: 1 });
userSchema.index({ role: 1, program: 1, year: 1 });
userSchema.index({ appliedProject: 1, level: 1 });
userSchema.index({ level: 1 });
userSchema.index({ name: 'text', studentId: 'text', email: 'text' });

// Email casing is preserved as-is; no normalization hook needed.

module.exports = mongoose.model('User', userSchema);
