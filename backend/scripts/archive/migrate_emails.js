const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');

async function migrate_emails() {
    await connectDB();
    const users = await User.find({}).lean();

    let updated = 0;
    for (const user of users) {
        if (user.email && user.email !== user.email.toLowerCase()) {
            await User.updateOne(
                { _id: user._id },
                { $set: { email: user.email.toLowerCase() } }
            );
            updated++;
        }
    }
    console.log(`Updated ${updated} emails.`);
}
migrate_emails()
    .catch(console.error)
    .finally(() => mongoose.disconnect().then(() => process.exit(0)));
