require('dotenv').config();
const mongoose = require('mongoose');
const Department = require('./src/models/Department');

async function checkDepts() {
    const uri = process.env.MONGO_URI;
    await mongoose.connect(uri);
    const depts = await Department.find().lean();
    console.log(JSON.stringify(depts.map(d => d.name), null, 2));
    mongoose.disconnect();
}

checkDepts().catch(console.error);
