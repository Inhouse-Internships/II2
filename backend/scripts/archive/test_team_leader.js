const mongoose = require('mongoose');
const Project = require('./models/Project');
const User = require('./models/User');
const Task = require('./models/Task');
const TaskSubmission = require('./models/TaskSubmission');
const { ROLES, USER_STATUS, PROJECT_STATUS } = require('./utils/constants');
const adminController = require('./controllers/adminController');
const taskController = require('./controllers/taskController');

async function testTeamLeader() {
    await mongoose.connect('mongodb://127.0.0.1:27017/internship_portal');
    console.log("Connected to test DB");

    // Clean up
    await Project.deleteMany({ title: "Test Team Leader Project" });
    await User.deleteMany({ email: { $in: ["s1@test.com", "s2@test.com"] } });
    await Task.deleteMany({ title: "Test Task TL" });

    // 1. Create Project
    const proj = await Project.create({
        title: "Test Team Leader Project",
        projectId: "TEST-TL-01",
        baseDept: "CSE",
        status: PROJECT_STATUS.OPEN,
        departments: [{
            department: new mongoose.Types.ObjectId(), // Fake ID
            seats: 5
        }]
    });
    console.log("Created project:", proj._id);

    // 2. Create Students
    let student1 = await User.create({
        name: "Student 1",
        email: "s1@test.com",
        phone: "123",
        password: "pwd",
        role: ROLES.STUDENT,
        studentId: "101",
        department: "CSE",
        year: "3",
        status: USER_STATUS.APPROVED,
        level: 1,
        appliedProject: proj._id
    });

    let student2 = await User.create({
        name: "Student 2",
        email: "s2@test.com",
        phone: "124",
        password: "pwd",
        role: ROLES.STUDENT,
        studentId: "102",
        department: "CSE",
        year: "3",
        status: USER_STATUS.APPROVED,
        level: 1,
        appliedProject: proj._id
    });
    console.log("Created students");

    const mockRes = () => {
        const res = {};
        res.status = (code) => { res.statusCode = code; return res; };
        res.json = (data) => console.log(`Response [${res.statusCode}]:`, data);
        return res;
    };

    // 3. Move Student 1 to Level 2
    console.log("\n--- Moving Student 1 to L2 ---");
    let req = { body: { studentIds: [student1._id], level: 2 } };
    await adminController.moveStudentLevel(req, mockRes());

    let updatedProj = await Project.findById(proj._id);
    console.log("Team Leader after S1 move:", updatedProj.teamLeader);
    if (String(updatedProj.teamLeader) !== String(student1._id)) throw new Error("S1 should be TL");

    // 4. Move Student 2 to Level 2
    console.log("\n--- Moving Student 2 to L2 ---");
    req = { body: { studentIds: [student2._id], level: 2 } };
    await adminController.moveStudentLevel(req, mockRes());

    updatedProj = await Project.findById(proj._id);
    console.log("Team Leader after S2 move:", updatedProj.teamLeader);
    if (String(updatedProj.teamLeader) !== String(student1._id)) throw new Error("S1 should still be TL");

    // 5. Test Submission Rules
    const task = await Task.create({
        title: "Test Task TL",
        description: "Desc",
        project: proj._id,
        startDate: new Date(),
        deadline: new Date(Date.now() + 86400000)
    });

    console.log("\n--- Non-leader (S2) submitting task ---");
    // Ensure we send expected format: task ID in params
    let taskReq = {
        params: { taskId: task._id },
        body: { descriptionOfWork: "Work", completionPercentage: 100, project: proj._id },
        user: student2 // S2 is not leader
    };
    try {
        await taskController.submitTask(taskReq, mockRes());
    } catch (err) {
        console.log("Expected Error S2:", err.message);
    }

    // Refresh student1 to get updated project references for task submission checking
    student1 = await User.findById(student1._id).populate('appliedProject');

    console.log("\n--- Leader (S1) submitting task ---");
    taskReq = {
        params: { taskId: task._id },
        body: { descriptionOfWork: "Work", completionPercentage: 100, project: proj._id },
        user: student1 // S1 is leader
    };
    await taskController.submitTask(taskReq, mockRes());
    console.log("S1 submitted task successfully");

    // 6. Delete Leader (S1)
    console.log("\n--- Deleting S1 (Current Leader) ---");
    req = { params: { id: student1._id } };
    await adminController.deleteStudent(req, mockRes());

    updatedProj = await Project.findById(proj._id);
    console.log("Team Leader after S1 deleted:", updatedProj.teamLeader);
    if (String(updatedProj.teamLeader) !== String(student2._id)) throw new Error("S2 should now be TL");

    console.log("\nAll tests passed!");

    // Clean up
    await Project.deleteMany({ title: "Test Team Leader Project" });
    await User.deleteMany({ email: { $in: ["s1@test.com", "s2@test.com"] } });
    await Task.deleteMany({ title: "Test Task TL" });
    await TaskSubmission.deleteMany({ task: task._id });

    mongoose.disconnect();
}

testTeamLeader().catch(console.error);
