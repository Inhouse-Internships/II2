require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

async function checkDepts() {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('MONGO_URI is not defined in .env');

    await mongoose.connect(uri);
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

    console.log('--- Students per Department ---');
    console.log(JSON.stringify(studentDepts, null, 2));
    console.log('--- HODs per Department ---');
    console.log(JSON.stringify(hodDepts, null, 2));

    mongoose.disconnect();
}

checkDepts().catch(console.error);
