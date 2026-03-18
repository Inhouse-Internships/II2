const mongoose = require('mongoose');
require('dotenv').config();
const connectDB = require('./config/db');

const Attendance = require('./models/Attendance');
const DailyStatus = require('./models/DailyStatus');
const Department = require('./models/Department');
const Program = require('./models/Program');
const Project = require('./models/Project');
const Review = require('./models/Review');
const Setting = require('./models/Setting');
const Task = require('./models/Task');
const TaskSubmission = require('./models/TaskSubmission');
const User = require('./models/User');

async function syncIndexes() {
    try {
        console.log('Connecting to database...');
        await connectDB();

        const models = [
            Attendance,
            DailyStatus,
            Department,
            Program,
            Project,
            Review,
            Setting,
            Task,
            TaskSubmission,
            User
        ];

        for (const model of models) {
            console.log(`Syncing indexes for ${model.modelName}...`);
            await model.syncIndexes();
        }

        console.log('All indexes synced successfully!');
    } catch (error) {
        console.error('Error syncing indexes:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

syncIndexes();
