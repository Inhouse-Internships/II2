const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });
const connectDB = require('../src/config/db');
const User = require('../src/models/User');
const { hashPassword } = require('../src/utils/password');
const { ROLES, USER_STATUS } = require('../src/utils/constants');

async function resetAdmin() {
    try {
        const email = 'admin@adityauniversity.in';
        const newPassword = 'admin123';

        console.log('Connecting to database...');
        await connectDB();

        console.log(`Hashing new password for ${email}...`);
        const hashedPassword = await hashPassword(newPassword);

        console.log(`Ensuring admin user exists: ${email}...`);
        const result = await User.findOneAndUpdate(
            { email },
            {
                $set: {
                    password: hashedPassword,
                    role: ROLES.ADMIN,
                    status: USER_STATUS.APPROVED,
                    name: 'System Admin'
                }
            },
            { upsert: true, new: true }
        );

        if (result) {
            console.log(`Successfully reset/created admin: ${email}`);
            console.log(`Default password: ${newPassword}`);
        }
    } catch (err) {
        console.error('Error during password reset:', err.message);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

resetAdmin();
