require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { Types } = mongoose;

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 4000;
const MONGO = process.env.MONGO_URI || 'mongodb://localhost:27017/taskflow';
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// ------------------ Mongoose Models ------------------

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['member','admin','owner'], default: 'member' },
  avatarUrl: String,
}, { timestamps: true });

const teamSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  description: String,
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true, index: true },
  description: String,
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  assignees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  status: { type: String, enum: ['todo','in-progress','review','done'], default: 'todo', index: true },
  priority: { type: String, enum: ['low','medium','high'], default: 'medium' },
  dueDate: Date,
  // position is used for ordering within a column (kanban)
  position: { type: Number, default: 0 },
  labels: [String],
  comments: [{ author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, text: String, createdAt: Date }]
}, { timestamps: true });

// text index for search
taskSchema.index({ title: 'text', description: 'text', labels: 'text' });
projectSchema.index({ name: 'text', description: 'text' });
userSchema.index({ name: 'text', email: 'text' });

const User = mongoose.model('User', userSchema);
const Team = mongoose.model('Team', teamSchema);
const Project = mongoose.model('Project', projectSchema);
const Task = mongoose.model('Task', taskSchema);

// ------------------ Helpers & Middleware ------------------

function generateToken(user) {
  return jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Missing auth header' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-passwordHash');
    if (!req.user) return res.status(401).json({ error: 'User not found' });
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// ------------------ Auth Routes ------------------

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already registered' });
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const user = new User({ name, email, passwordHash });
    await user.save();
    const token = generateToken(user);
    res.json({ user: { id: user._id, name: user.name, email: user.email }, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Missing fields' });
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(400).json({ error: 'Invalid credentials' });
    const token = generateToken(user);
    res.json({ user: { id: user._id, name: user.name, email: user.email }, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ------------------ User endpoints ------------------
app.get('/api/users/me', authMiddleware, async (req, res) => {
  res.json({ user: req.user });
});

// ------------------ Team endpoints ------------------
app.post('/api/teams', authMiddleware, async (req, res) => {
  try {
    const { name, description, members } = req.body;
    const team = new Team({ name, description, members: members || [], createdBy: req.user._id });
    await team.save();
    res.json(team);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/teams/:id', authMiddleware, async (req, res) => {
  try {
    const team = await Team.findById(req.params.id).populate('members', 'name email');
    if (!team) return res.status(404).json({ error: 'Team not found' });
    res.json(team);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// ------------------ Project endpoints ------------------
app.post('/api/projects', authMiddleware, async (req, res) => {
  try {
    const { name, description, team, members } = req.body;
    const project = new Project({ name, description, team, members: members || [], createdBy: req.user._id });
    await project.save();
    res.json(project);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/projects/:id', authMiddleware, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id).populate('members', 'name email').populate('team');
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// list projects (with optional team filter and pagination)
app.get('/api/projects', authMiddleware, async (req, res) => {
  try {
    const { team, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (team) filter.team = team;
    const projects = await Project.find(filter).skip((page-1)*limit).limit(parseInt(limit,10)).sort({ createdAt: -1 });
    res.json(projects);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// ------------------ Task endpoints (CRUD + kanban move) ------------------
app.post('/api/tasks', authMiddleware, async (req, res) => {
  try {
    const { title, description, project, assignees, status, priority, dueDate, labels } = req.body;
    // determine max position within status column for the project
    const maxPosDoc = await Task.findOne({ project, status }).sort('-position').select('position').lean();
    const position = maxPosDoc ? maxPosDoc.position + 1 : 0;
    const task = new Task({ title, description, project, assignees: assignees || [], status: status || 'todo', priority: priority || 'medium', dueDate, labels: labels || [], position });
    await task.save();
    res.json(task);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/tasks/:id', authMiddleware, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).populate('assignees', 'name email').populate('project');
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.put('/api/tasks/:id', authMiddleware, async (req, res) => {
  try {
    const updates = req.body;
    const task = await Task.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.delete('/api/tasks/:id', authMiddleware, async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// Kanban move endpoint: change status and position, reorder other tasks
app.post('/api/tasks/:id/move', authMiddleware, async (req, res) => {
  /*
    body: { toStatus: 'in-progress', toPosition: 2 }
    This will move task to the given column and target position and shift other tasks accordingly.
  */
  try {
    const { toStatus, toPosition } = req.body;
    const taskId = req.params.id;
    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const project = task.project;
    const fromStatus = task.status;
    const fromPosition = task.position;

    // Remove gap in original column
    await Task.updateMany({ project, status: fromStatus, position: { $gt: fromPosition } }, { $inc: { position: -1 } });

    // Increase positions at destination column at or after toPosition
    await Task.updateMany({ project, status: toStatus, position: { $gte: toPosition } }, { $inc: { position: 1 } });

    task.status = toStatus;
    task.position = toPosition;
    await task.save();

    res.json(task);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// List tasks for a project with columns
app.get('/api/projects/:id/board', authMiddleware, async (req, res) => {
  try {
    const projectId = req.params.id;
    const tasks = await Task.find({ project: projectId }).sort({ status: 1, position: 1 }).populate('assignees', 'name email');
    // group by status
    const board = { todo: [], 'in-progress': [], review: [], done: [] };
    tasks.forEach(t => board[t.status].push(t));
    res.json(board);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// ------------------ Search ------------------
app.get('/api/search', authMiddleware, async (req, res) => {
  try {
    const q = req.query.q || '';
    if (!q) return res.status(400).json({ error: 'Missing query param q' });
    // search across tasks, projects, users (text index + regex fallback)
    const textQuery = { $text: { $search: q } };
    const [tasks, projects, users] = await Promise.all([
      Task.find(textQuery).limit(50),
      Project.find(textQuery).limit(50),
      User.find(textQuery).limit(50).select('name email')
    ]);
    res.json({ tasks, projects, users });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ------------------ Analytics ------------------
app.get('/api/analytics/project/:id/overview', authMiddleware, async (req, res) => {
  try {
    const projectId = req.params.id;
    const [totalTasks, byStatus, overdueCount] = await Promise.all([
      Task.countDocuments({ project: projectId }),
      Task.aggregate([
        { $match: { project: Types.ObjectId(projectId) } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Task.countDocuments({ project: projectId, dueDate: { $lt: new Date() }, status: { $ne: 'done' } })
    ]);
    res.json({ totalTasks, byStatus, overdueCount });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ------------------ Utility / Admin helpers ------------------
app.post('/api/admin/seed', async (req, res) => {
  // Unsafe endpoint for demo seeding - remove or protect in production
  try {
    await User.deleteMany({});
    await Team.deleteMany({});
    await Project.deleteMany({});
    await Task.deleteMany({});

    const pw = await bcrypt.hash('pass123', 10);
    const userA = await User.create({ name: 'Alice', email: 'alice@example.com', passwordHash: pw, role: 'owner' });
    const userB = await User.create({ name: 'Bob', email: 'bob@example.com', passwordHash: pw, role: 'member' });

    const team = await Team.create({ name: 'Alpha Team', description: 'Product team', members: [userA._id, userB._id], createdBy: userA._id });
    const project = await Project.create({ name: 'Website Redesign', description: 'Revamp UI', team: team._id, members: [userA._id, userB._id], createdBy: userA._id });

    const t1 = await Task.create({ title: 'Design hero section', description: 'Create variants', project: project._id, assignees: [userA._id], status: 'todo', position: 0 });
    const t2 = await Task.create({ title: 'Implement auth', description: 'Login/Register flows', project: project._id, assignees: [userB._id], status: 'in-progress', position: 0 });
    const t3 = await Task.create({ title: 'Set up CI', description: 'Configure tests', project: project._id, assignees: [], status: 'review', position: 0 });

    res.json({ seeded: true, users: [userA, userB], team, project, tasks: [t1, t2, t3] });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ------------------ Connect and listen ------------------

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Mongo connected');
    app.listen(PORT, () => console.log(`TaskFlow backend running on port ${PORT}`));
  })
  .catch(err => {
    console.error('Mongo connection error', err);
    process.exit(1);
  });


