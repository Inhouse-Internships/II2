const mongoose = require('mongoose');
const User = require('./backend/src/models/User');
const env = require('./backend/src/config/env');

async function checkDepts() {
    await mongoose.connect(env.MONGODB_URI);
    console.log('Connected to DB');

    const students = await User.find({ role: 'student' }).lean();
    const hods = await User.find({ role: 'hod' }).lean();

    const studentDepts = {};
    students.forEach(s => {
        studentDepts[s.department] = (studentDepts[s.department] || 0) + 1;
    });

    const hodDepts = {};
    hods.forEach(h => {
        hodDepts[h.department] = (hodDepts[h.department] || 0) + 1;
    });

    console.log('Student Departments:', JSON.stringify(studentDepts, null, 2));
    console.log('HOD Departments:', JSON.stringify(hodDepts, null, 2));

    mongoose.disconnect();
}

checkDepts().catch(console.error);
