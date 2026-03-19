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
  const ADMIN_EMAIL = 'admin@adityauniversity.in';
  const LEGACY_ADMIN_EMAIL = 'admin';

  try {
    // Check if any admin exists
    const adminExists = await User.findOne({ role: ROLES.ADMIN });
    
    if (!adminExists) {
      // Check if the desired email is taken
      const emailTaken = await User.findOne({ email: ADMIN_EMAIL });
      
      if (!emailTaken) {
        console.log(`[seed] No admin user detected. Creating default admin (${ADMIN_EMAIL})...`);
        
        const hashedPassword = await hashPassword('admin123');
        
        await User.create({
          name: 'Inhouse-Internships',
          email: ADMIN_EMAIL,
          password: hashedPassword,
          role: ROLES.ADMIN,
          status: USER_STATUS.APPROVED
        });
        
        console.log('[seed] Default admin created successfully:');
        console.log(`       Email: ${ADMIN_EMAIL}`);
        console.log('       Password: admin123');
      }
    } else {
      // If an admin exists but has the email 'admin', we should probably rename it
      // or at least warn. But usually, if they are getting 401 with admin@...,
      // it's because they have 'admin' in DB but typing 'admin@...'.
      const legacyAdmin = await User.findOne({ email: LEGACY_ADMIN_EMAIL, role: ROLES.ADMIN });
      if (legacyAdmin) {
        console.log(`[seed] Legacy 'admin' user detected. Migrating to '${ADMIN_EMAIL}' for convenience...`);
        legacyAdmin.email = ADMIN_EMAIL;
        await legacyAdmin.save();
      }
    }
  } catch (error) {
    console.error('[seed] Error seeding admin user:', error.message);
  }
}

module.exports = seedAdmin;
