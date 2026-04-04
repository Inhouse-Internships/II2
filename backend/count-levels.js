require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

async function countLevels() {
    const uri = process.env.MONGO_URI;
    await mongoose.connect(uri);
    const l1 = await User.countDocuments({ role: 'student', level: 1 });
    const l2 = await User.countDocuments({ role: 'student', level: 2 });
    const l_unset = await User.countDocuments({ role: 'student', level: { $exists: false } });

    console.log('Level 1:', l1);
    console.log('Level 2:', l2);
    console.log('Level Unset:', l_unset);

    mongoose.disconnect();
}

countLevels().catch(console.error);
