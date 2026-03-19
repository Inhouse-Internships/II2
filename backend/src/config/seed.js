const User = require('../models/User');
const { ROLES, USER_STATUS } = require('../utils/constants');
const { hashPassword } = require('../utils/password');

/**
 * Seeds a default admin user if no admin exists in the database.
 * Default Credentials:
 *   Username/Email: admin
 *   Password: admin123
 */
async function seedAdmin() {
  try {
    // Check if any admin exists
    const adminExists = await User.findOne({ role: ROLES.ADMIN });
    
    if (!adminExists) {
      // Check if 'admin' email is already taken (unlikely if no admin exists, but safe to check)
      const emailTaken = await User.findOne({ email: 'admin' });
      
      if (!emailTaken) {
        // eslint-disable-next-line no-console
        console.log('[seed] No admin user detected. Creating default admin...');
        
        const hashedPassword = await hashPassword('admin123');
        
        await User.create({
          name: 'System Admin',
          email: 'admin',
          password: hashedPassword,
          role: ROLES.ADMIN,
          status: USER_STATUS.APPROVED
        });
        
        // eslint-disable-next-line no-console
        console.log('[seed] Default admin created successfully:');
        // eslint-disable-next-line no-console
        console.log('       Email: admin');
        // eslint-disable-next-line no-console
        console.log('       Password: admin123');
      } else {
        // eslint-disable-next-line no-console
        console.warn('[seed] "admin" identifier is already taken, but no user has ADMIN role. Skipping auto-seed.');
      }
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[seed] Error seeding admin user:', error.message);
  }
}

module.exports = seedAdmin;
