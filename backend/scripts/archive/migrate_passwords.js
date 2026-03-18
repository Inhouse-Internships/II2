const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../src/config/db');
const User = require('../src/models/User');
const env = require('../src/config/env');

async function migrate() {
    await connectDB();
    const usersToMigrate = await User.find({
        $or: [
            { password: { $exists: false } },
            { password: { $not: /^\$2[aby]\$/ } }
        ]
    }).select('_id password').lean();

    console.log(`Found ${usersToMigrate.length} users with missing or plaintext passwords.`);

    if (usersToMigrate.length === 0) {
        console.log('No users require password migration.');
        return;
    }

    const bulkOps = [];
    for (const user of usersToMigrate) {
        const passwordToHash = (user.password || '').trim() || env.DEFAULT_IMPORTED_USER_PASSWORD;

        if (passwordToHash) {
            const salt = await bcrypt.genSalt(env.BCRYPT_SALT_ROUNDS);
            const hash = await bcrypt.hash(passwordToHash, salt);
            bulkOps.push({
                updateOne: {
                    filter: { _id: user._id },
                    update: { $set: { password: hash } }
                }
            });
        }
    }

    const result = await User.bulkWrite(bulkOps);
    console.log(`Updated ${result.modifiedCount} users.`);
}
migrate()
    .catch(console.error)
    .finally(() => mongoose.disconnect().then(() => process.exit(0)));
