// server.js
const express = require("express");
const mongoose = require("mongoose");
const app = express();

app.use(express.json());

// --- MongoDB Connection ---
mongoose.connect("mongodb://localhost:27017/unifiedAPI");


// --- Schemas ---
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
});

const workExperienceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  company: String,
  position: String,
  technologies: [String],
  startDate: Date,
  endDate: Date,
});

const projectSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  title: String,
  technologies: [String],
  status: { type: String, enum: ["completed", "in-progress"] },
});

const skillSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  name: String,
  proficiency: Number, // 1–5
});

// --- Models ---
const User = mongoose.model("User", userSchema);
const WorkExperience = mongoose.model("WorkExperience", workExperienceSchema);
const Project = mongoose.model("Project", projectSchema);
const Skill = mongoose.model("Skill", skillSchema);

// --- Routes ---
// Create user
app.post("/api/users", async (req, res) => {
  const user = new User(req.body);
  await user.save();
  res.json(user);
});

app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add project
app.post("/api/projects", async (req, res) => {
  const project = new Project(req.body);
  await project.save();
  res.json(project);
});

// Add a skill for a user
app.post("/api/skills", async (req, res) => {
  try {
    console.log("Skill endpoint hit:", req.body); 

    const skill = new Skill(req.body);
    await skill.save();
    res.json(skill);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Unified Profile (joins multiple resources)
app.get("/api/profile/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    const workExperience = await WorkExperience.find({ user: userId });
    const projects = await Project.find({ user: userId });
    const skills = await Skill.find({ user: userId });

    res.json({
      user,
      workExperience,
      projects,
      skills,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Advanced Query Example: Find all projects using a skill
app.get("/api/projects/by-skill/:skillName", async (req, res) => {
  const { skillName } = req.params;
  const projects = await Project.find({ technologies: skillName });
  res.json(projects);
});

const PORT = 4000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
