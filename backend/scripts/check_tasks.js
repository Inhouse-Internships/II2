
const mongoose = require('mongoose');
const Task = require('./models/Task');
const env = require('./config/env');

async function checkTasks() {
    try {
        await mongoose.connect(env.MONGODB_URI);
        const count = await Task.countDocuments();
        console.log('Total tasks:', count);
        const tasks = await Task.find().limit(5).lean();
        console.log('Sample tasks:', JSON.stringify(tasks, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkTasks();
