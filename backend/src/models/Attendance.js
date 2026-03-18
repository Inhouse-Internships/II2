const mongoose = require('mongoose');
const { ATTENDANCE_STATUS, ROLES } = require('../utils/constants');

const attendanceSchema = new mongoose.Schema(
    {
        studentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        projectId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Project',
            required: true
        },
        facultyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        departmentId: {
            type: String, // String because departments are often identified by their name in this project (e.g., 'CSE', 'ECE') 
            required: true
        },
        date: {
            type: Date,
            required: true
        },
        attendanceStatus: {
            type: String,
            enum: Object.values(ATTENDANCE_STATUS),
            required: true
        },
        remarks: {
            type: String,
            default: ''
        },
        latitude: {
            type: Number
        },
        longitude: {
            type: Number
        },
        accuracy: {
            type: Number
        },
        locationStatus: {
            type: String,
            enum: ['Inside Campus', 'Outside Campus', 'N/A'],
            default: 'N/A'
        },
        ipAddress: {
            type: String
        },
        markedByRole: {
            type: String,
            enum: [ROLES.FACULTY, ROLES.HOD, ROLES.ADMIN, ROLES.STUDENT],
            required: true
        },
        modifiedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        modificationTimestamp: {
            type: Date
        },
        previousAttendanceStatus: {
            type: String,
            enum: Object.values(ATTENDANCE_STATUS)
        }
    },
    { timestamps: true }
);

// Crucial: Only one attendance record per student per project per day
attendanceSchema.index({ studentId: 1, projectId: 1, date: 1 }, { unique: true });

// Performance indexes for faster querying across dashboards
attendanceSchema.index({ projectId: 1, date: -1 });
attendanceSchema.index({ departmentId: 1, date: -1 });
attendanceSchema.index({ studentId: 1, date: -1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
