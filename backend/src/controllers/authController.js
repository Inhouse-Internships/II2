const User = require('../models/User');
const Setting = require('../models/Setting');
const env = require('../config/env');
const { sendMail } = require('../mailer');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/appError');
const { successResponse } = require('../utils/response');
const { hashPassword, comparePassword, validatePasswordStrength } = require('../utils/password');
const { signToken } = require('../utils/jwt');
const { ROLES, USER_STATUS, SETTING_KEYS } = require('../utils/constants');
const { issueOtp, verifyOtp: verifyStoredOtp, consumeOtp } = require('../services/otpService');
const { syncFacultyProjectByEmpId } = require('../utils/projectUtils');
const { sanitizeUser, normalizeEmail, escapeRegex, checkEmailProhibited } = require('../utils/userUtils');
const { auditLogin } = require('../utils/logger');
const { getOtpEmailTemplate } = require('../utils/emailTemplates');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OTP_PURPOSE = Object.freeze({
  REGISTRATION: 'registration',
  PASSWORD_RESET: 'password-reset'
});

const SELF_REGISTER_ROLES = Object.freeze([ROLES.STUDENT, ROLES.FACULTY]);

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

async function sendOtpEmail(email, otp, purpose) {
  const isPasswordReset = purpose === OTP_PURPOSE.PASSWORD_RESET;
  const subject = isPasswordReset
    ? 'Password Reset OTP - Inhouse Internships 2.0'
    : 'Registration OTP - Inhouse Internships 2.0';

  const html = getOtpEmailTemplate({
    otp,
    purpose,
    expiryMinutes: env.OTP_TTL_MINUTES,
    email,
    baseUrl: env.FRONTEND_URL
  });

  const text = `Your OTP is ${otp}. It will expire in ${env.OTP_TTL_MINUTES} minutes.`;

  await sendMail({ to: email, subject, text, html });
}

// ---------------------------------------------------------------------------
// Controllers
// ---------------------------------------------------------------------------

const sendOtp = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  if (!email) throw new AppError(400, 'Email is required');
  checkEmailProhibited(email);

  const otp = await issueOtp({
    email,
    purpose: OTP_PURPOSE.REGISTRATION,
    ttlMinutes: env.OTP_TTL_MINUTES
  });

  const purpose = OTP_PURPOSE.REGISTRATION;
  if (!env.IS_PRODUCTION) {
    // eslint-disable-next-line no-console
    console.log(`[DEV] OTP for ${email}: ${otp} (${purpose})`);
  }

  try {
    await sendOtpEmail(email, otp, purpose);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('SMTP Error:', error.message);
  }

  return successResponse(res, {}, 'OTP sent successfully');
});

const verifyOtp = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const otp = String(req.body.otp || '').trim();

  if (!email || !otp) throw new AppError(400, 'Email and OTP are required');

  const result = await verifyStoredOtp({ email, otp, purpose: OTP_PURPOSE.REGISTRATION });

  if (!result.valid) throw new AppError(400, result.reason);

  return successResponse(res, {}, 'OTP verified successfully');
});

const register = asyncHandler(async (req, res) => {
  const { name, email: rawEmail, password, otp, ...rest } = req.body;
  const role = String(req.body.role || ROLES.STUDENT).trim().toLowerCase();
  const email = normalizeEmail(rawEmail);
  checkEmailProhibited(email);

  if (!name || !email || !password) {
    throw new AppError(400, 'Name, email and password are required');
  }

  const passwordError = validatePasswordStrength(password);
  if (passwordError) throw new AppError(400, passwordError);

  if (!SELF_REGISTER_ROLES.includes(role)) {
    throw new AppError(403, 'Self-registration is only allowed for student and faculty roles');
  }

  if (role === ROLES.STUDENT && !rest.studentId) {
    throw new AppError(400, 'Student ID is required for student registration');
  }

  if (role === ROLES.FACULTY && !rest.employeeId) {
    throw new AppError(400, 'Employee ID is required for faculty registration');
  }

  if (role === ROLES.FACULTY && rest.employeeId && !/^\d+$/.test(String(rest.employeeId).trim())) {
    throw new AppError(400, 'Employee ID must contain only digits');
  }

  // Role-specific registration check
  if (role === ROLES.STUDENT) {
    const studentRegSetting = await Setting.findOne({ key: SETTING_KEYS.STUDENT_REGISTRATION_ENABLED }).lean();
    if (studentRegSetting && !studentRegSetting.value) {
      throw new AppError(403, 'Student registrations are currently disabled.');
    }
  } else if (role === ROLES.FACULTY) {
    const facultyRegSetting = await Setting.findOne({ key: SETTING_KEYS.FACULTY_REGISTRATION_ENABLED }).lean();
    if (facultyRegSetting && !facultyRegSetting.value) {
      throw new AppError(403, 'Faculty registrations are currently disabled.');
    }
  }

  // FIX S-8: Case-insensitive indexed equality lookup
  const existingUser = await User.findOne({ email: { $regex: new RegExp(`^${escapeRegex(email)}$`, 'i') } }).lean();
  if (existingUser) throw new AppError(409, 'User already exists with this email');

  if (rest.studentId) {
    const existingStudentId = await User.findOne({ studentId: String(rest.studentId).toUpperCase() }).lean();
    if (existingStudentId) throw new AppError(409, 'Student ID already exists');
  }

  const normalizedEmployeeId = rest.employeeId ? String(rest.employeeId).trim() : undefined;
  if (normalizedEmployeeId) {
    const existingEmployeeId = await User.findOne({ employeeId: normalizedEmployeeId }).lean();
    if (existingEmployeeId) throw new AppError(409, 'Employee ID already exists');
  }

  if (env.REQUIRE_REGISTRATION_OTP) {
    if (!otp) throw new AppError(400, 'OTP is required for registration');
    const otpValidation = await consumeOtp({ email, otp, purpose: OTP_PURPOSE.REGISTRATION, requireVerified: true });
    if (!otpValidation.valid) throw new AppError(400, otpValidation.reason);
  }

  const hashedPassword = await hashPassword(password);

  const user = await User.create({
    ...rest,
    name: String(name).trim(),
    email, // already normalized to lowercase
    role,
    status: USER_STATUS.PENDING,
    password: hashedPassword,
    studentId: rest.studentId ? String(rest.studentId).toUpperCase() : undefined,
    employeeId: normalizedEmployeeId
  });

  if (user.role === ROLES.FACULTY) {
    await syncFacultyProjectByEmpId(user, 'faculty');
    await user.save();
  }

  return successResponse(res, { user: sanitizeUser(user) }, 'Registration successful', 201);
});

const login = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  checkEmailProhibited(email);
  const password = req.body.password;

  if (!email || !password) {
    throw new AppError(400, 'Email and password are required');
  }

  // Case-insensitive indexed lookup
  let user = await User.findOne({
    email: { $regex: new RegExp(`^${escapeRegex(email)}$`, 'i') }
  }).select('+password');

  // Fallback: try student ID or employee ID
  if (!user) {
    let rawInput = String(req.body.email || '').trim();
    for (const domain of env.UNIVERSITY_EMAIL_DOMAINS) {
      if (domain && rawInput.toLowerCase().endsWith(domain.toLowerCase())) {
        rawInput = rawInput.substring(0, rawInput.length - domain.length);
        break;
      }
    }
    user = await User.findOne({
      $or: [
        { studentId: rawInput.toUpperCase() },
        { employeeId: rawInput }
      ]
    }).select('+password');
  }

  if (!user) {
    auditLogin('FAIL', `User not found for input "${req.body.email}" (IP: ${req.ip})`);
    throw new AppError(401, 'Invalid credentials');
  }

  const passwordMatched = await comparePassword(password, user.password);
  if (!passwordMatched) {
    auditLogin('FAIL', `Password mismatch for user "${user.email}" (IP: ${req.ip})`);
    throw new AppError(401, 'Invalid credentials');
  }

  const token = signToken({
    sub: user._id.toString(),
    role: user.role,
    tv: user.tokenVersion || 0  // token version for invalidation support
  });

  auditLogin('SUCCESS', `User "${user.email}" (Role: ${user.role}) logged in (IP: ${req.ip})`);

  return successResponse(res, {
    token,
    role: user.role,
    user: sanitizeUser(user)
  }, 'Login successful');
});

const forgotPassword = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  if (!email) throw new AppError(400, 'Email is required');
  checkEmailProhibited(email);

  // Case-insensitive lookup
  const user = await User.findOne({
    email: { $regex: new RegExp(`^${escapeRegex(email)}$`, 'i') }
  }).lean();
  if (!user) throw new AppError(404, 'No account found for this email');

  const otp = await issueOtp({ email, purpose: OTP_PURPOSE.PASSWORD_RESET, ttlMinutes: env.OTP_TTL_MINUTES });

  const purpose = OTP_PURPOSE.PASSWORD_RESET;
  if (!env.IS_PRODUCTION) {
    // eslint-disable-next-line no-console
    console.log(`[DEV] OTP for ${email}: ${otp} (${purpose})`);
  }

  try {
    await sendOtpEmail(email, otp, purpose);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('SMTP Error:', error.message);
  }

  return successResponse(res, {}, 'Password reset OTP sent successfully');
});

const resetPassword = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  checkEmailProhibited(email);
  const otp = String(req.body.otp || '').trim();
  const newPassword = req.body.newPassword;

  if (!email || !otp || !newPassword) {
    throw new AppError(400, 'Email, OTP and new password are required');
  }

  const passwordError = validatePasswordStrength(newPassword);
  if (passwordError) throw new AppError(400, passwordError);

  const otpValidation = await consumeOtp({ email, otp, purpose: OTP_PURPOSE.PASSWORD_RESET });
  if (!otpValidation.valid) throw new AppError(400, otpValidation.reason);

  // Case-insensitive lookup
  const user = await User.findOne({
    email: { $regex: new RegExp(`^${escapeRegex(email)}$`, 'i') }
  }).select('+password');
  if (!user) throw new AppError(404, 'User not found');

  user.password = await hashPassword(newPassword);
  user.tokenVersion = (user.tokenVersion || 0) + 1; // invalidate all existing tokens
  await user.save();

  auditLogin('SUCCESS', `Password reset for user "${email}" (IP: ${req.ip})`);

  return successResponse(res, {}, 'Password reset successful');
});

const getConfig = asyncHandler(async (req, res) => {
  const [studentRegSetting, facultyRegSetting] = await Promise.all([
    Setting.findOne({ key: SETTING_KEYS.STUDENT_REGISTRATION_ENABLED }).lean(),
    Setting.findOne({ key: SETTING_KEYS.FACULTY_REGISTRATION_ENABLED }).lean()
  ]);

  return successResponse(res, {
    studentRegistrationEnabled: studentRegSetting ? Boolean(studentRegSetting.value) : true,
    facultyRegistrationEnabled: facultyRegSetting ? Boolean(facultyRegSetting.value) : true
  }, 'Config fetched');
});

module.exports = { sendOtp, verifyOtp, register, login, forgotPassword, resetPassword, getConfig };
