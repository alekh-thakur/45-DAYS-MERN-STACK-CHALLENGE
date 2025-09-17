require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { Types: { ObjectId } } = mongoose;

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/blogPlatform';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';

// ---------- Mongoose models (simple & extendable) ----------
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Mongo connected'))
  .catch(err => { console.error('Mongo connection error', err); process.exit(1); });

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['user','admin','moderator'], default: 'user' },
  bio: { type: String, default: '' },
  avatarUrl: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
});

const CommentSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  editedAt: { type: Date },
  isRemoved: { type: Boolean, default: false },
});

const PostSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  content: { type: String, required: true }, // store rich text (HTML/Markdown)
  excerpt: { type: String },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  categories: [{ type: String }],
  tags: [{ type: String }],
  comments: [CommentSchema],
  isPublished: { type: Boolean, default: false },
  publishedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  isRemoved: { type: Boolean, default: false },
});

const User = mongoose.model('User', UserSchema);
const Post = mongoose.model('Post', PostSchema);

// ---------- Middleware ----------
app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.json({ limit: '2mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(session({
  name: 'blog.sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: MONGO_URI }),
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  }
}));

// attach user object to req if logged in
app.use(async (req, res, next) => {
  if (req.session && req.session.userId) {
    try {
      const user = await User.findById(req.session.userId).select('-passwordHash');
      if (user) req.user = user;
    } catch (e) {
      console.warn('Failed to populate user', e);
    }
  }
  next();
});

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}

// ---------- Helper utils ----------
async function hashPassword(plain) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}

async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

function slugify(str) {
  return str.toString().toLowerCase().trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

// ---------- Auth Routes ----------
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: 'Missing fields' });
  try {
    const exists = await User.findOne({ $or: [{ username }, { email }] });
    if (exists) return res.status(409).json({ error: 'Username or email already taken' });
    const passwordHash = await hashPassword(password);
    const user = await User.create({ username, email, passwordHash });
    // create session
    req.session.userId = user._id;
    res.json({ success: true, user: { id: user._id, username: user.username, email: user.email } });
  } catch (e) {
    console.error('register error', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { emailOrUsername, password } = req.body;
  if (!emailOrUsername || !password) return res.status(400).json({ error: 'Missing fields' });
  try {
    const user = await User.findOne({ $or: [{ email: emailOrUsername }, { username: emailOrUsername }] });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    req.session.userId = user._id;
    res.json({ success: true, user: { id: user._id, username: user.username, email: user.email } });
  } catch (e) {
    console.error('login error', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.clearCookie('blog.sid');
    res.json({ success: true });
  });
});

app.get('/api/auth/me', (req, res) => {
  if (!req.user) return res.json({ user: null });
  res.json({ user: req.user });
});

// ---------- Posts Routes ----------

// Create post
app.post('/api/posts', requireAuth, async (req, res) => {
  try {
    const { title, content, categories = [], tags = [], excerpt = '', publish = false } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'Title and content required' });
    let slug = slugify(title);
    // ensure slug uniqueness
    let slugCandidate = slug;
    let suffix = 1;
    while (await Post.findOne({ slug: slugCandidate })) {
      slugCandidate = `${slug}-${suffix++}`;
    }
    slug = slugCandidate;
    const post = await Post.create({
      title, slug, content, excerpt, categories, tags, author: req.user._id,
      isPublished: !!publish,
      publishedAt: publish ? new Date() : null
    });
    res.json({ success: true, post });
  } catch (e) {
    console.error('create post', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get posts (list) with filters
app.get('/api/posts', async (req, res) => {
  try {
    const { page = 1, limit = 10, tag, category, authorId, q } = req.query;
    const skip = (Math.max(1, parseInt(page)) - 1) * Math.max(1, parseInt(limit));
    const filter = { isRemoved: false, isPublished: true };
    if (tag) filter.tags = tag;
    if (category) filter.categories = category;
    if (authorId && ObjectId.isValid(authorId)) filter.author = authorId;
    if (q) filter.$text = { $search: q }; // requires text index - optional

    const posts = await Post.find(filter)
      .sort({ publishedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('author', 'username avatarUrl');

    const total = await Post.countDocuments(filter);
    res.json({ posts, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    console.error('list posts', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single post by slug or id
app.get('/api/posts/:idOrSlug', async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    let post;
    if (ObjectId.isValid(idOrSlug)) {
      post = await Post.findById(idOrSlug).populate('author', 'username avatarUrl');
    }
    if (!post) post = await Post.findOne({ slug: idOrSlug }).populate('author', 'username avatarUrl');
    if (!post || post.isRemoved) return res.status(404).json({ error: 'Post not found' });
    if (!post.isPublished && (!req.user || req.user._id.toString() !== post.author._id.toString()) && (!req.user || req.user.role === 'user')) {
      // unpublished posts only visible to author or admin/moderator
      if (!req.user || (req.user._id.toString() !== post.author._id.toString() && req.user.role === 'user'))
        return res.status(403).json({ error: 'Not allowed to view this post' });
    }
    res.json({ post });
  } catch (e) {
    console.error('get post', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update post
app.put('/api/posts/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });
    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    // only author or admin/moderator
    if (post.author.toString() !== req.user._id.toString() && !['admin','moderator'].includes(req.user.role))
      return res.status(403).json({ error: 'Not allowed' });

    const updates = req.body;
    if (updates.title && updates.title !== post.title) {
      let slug = slugify(updates.title);
      let slugCandidate = slug;
      let suffix = 1;
      while (await Post.findOne({ slug: slugCandidate, _id: { $ne: post._id } })) {
        slugCandidate = `${slug}-${suffix++}`;
      }
      updates.slug = slugCandidate;
    }
    updates.updatedAt = new Date();
    if (updates.publish) {
      updates.isPublished = true;
      updates.publishedAt = new Date();
    }
    await Post.findByIdAndUpdate(id, updates, { new: true });
    res.json({ success: true });
  } catch (e) {
    console.error('update post', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete (soft remove) post
app.delete('/api/posts/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });
    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.author.toString() !== req.user._id.toString() && !['admin','moderator'].includes(req.user.role))
      return res.status(403).json({ error: 'Not allowed' });
    post.isRemoved = true;
    await post.save();
    res.json({ success: true });
  } catch (e) {
    console.error('delete post', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------- Comments ----------
app.post('/api/posts/:id/comments', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Comment content required' });
    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    const comment = { author: req.user._id, content };
    post.comments.push(comment);
    await post.save();
    res.json({ success: true, comment: post.comments[post.comments.length - 1] });
  } catch (e) {
    console.error('add comment', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/posts/:postId/comments/:commentId', requireAuth, async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Content required' });
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    const comment = post.comments.id(commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    if (comment.author.toString() !== req.user._id.toString() && !['admin','moderator'].includes(req.user.role))
      return res.status(403).json({ error: 'Not allowed' });
    comment.content = content;
    comment.editedAt = new Date();
    await post.save();
    res.json({ success: true, comment });
  } catch (e) {
    console.error('edit comment', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/posts/:postId/comments/:commentId', requireAuth, async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    const comment = post.comments.id(commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    if (comment.author.toString() !== req.user._id.toString() && !['admin','moderator'].includes(req.user.role))
      return res.status(403).json({ error: 'Not allowed' });
    comment.isRemoved = true;
    await post.save();
    res.json({ success: true });
  } catch (e) {
    console.error('remove comment', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------- User Profiles ----------
app.get('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });
    const user = await User.findById(id).select('-passwordHash');
    if (!user) return res.status(404).json({ error: 'User not found' });
    // fetch public posts count
    const postsCount = await Post.countDocuments({ author: user._id, isRemoved: false });
    res.json({ user, stats: { postsCount } });
  } catch (e) {
    console.error('get user', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/users/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user._id.toString() !== id && req.user.role !== 'admin') return res.status(403).json({ error: 'Not allowed' });
    const allowed = ['bio', 'avatarUrl', 'username', 'email'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    if (updates.username) {
      const existing = await User.findOne({ username: updates.username, _id: { $ne: id } });
      if (existing) return res.status(409).json({ error: 'Username already taken' });
    }
    await User.findByIdAndUpdate(id, updates);
    res.json({ success: true });
  } catch (e) {
    console.error('update user', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// change password
app.post('/api/users/:id/change-password', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;
    if (req.user._id.toString() !== id && req.user.role !== 'admin') return res.status(403).json({ error: 'Not allowed' });
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const ok = await verifyPassword(currentPassword, user.passwordHash);
    if (!ok && req.user.role !== 'admin') return res.status(401).json({ error: 'Current password incorrect' });
    user.passwordHash = await hashPassword(newPassword);
    await user.save();
    res.json({ success: true });
  } catch (e) {
    console.error('change password', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------- Admin Routes ----------
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const users = await User.find().select('-passwordHash');
    res.json({ users });
  } catch (e) {
    console.error('admin users', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/admin/users/:id/role', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (!['user','moderator','admin'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
    await User.findByIdAndUpdate(id, { role });
    res.json({ success: true });
  } catch (e) {
    console.error('admin set role', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin moderate posts
app.get('/api/admin/posts', requireAdmin, async (req, res) => {
  try {
    const posts = await Post.find().populate('author', 'username').limit(200);
    res.json({ posts });
  } catch (e) {
    console.error('admin posts', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/admin/posts/:id/publish', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await Post.findByIdAndUpdate(id, { isPublished: true, publishedAt: new Date() });
    res.json({ success: true });
  } catch (e) {
    console.error('admin publish', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/admin/posts/:id/unpublish', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await Post.findByIdAndUpdate(id, { isPublished: false });
    res.json({ success: true });
  } catch (e) {
    console.error('admin unpublish', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------- Misc / Health ----------
app.get('/api/health', (req, res) => res.json({ ok: true }));

// ---------- Start server ----------
app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));


// ---------- Indexes (optional) ----------
// create text index for search if you plan to use q param
Post.collection.createIndex({ title: 'text', content: 'text', tags: 'text' }).catch(() => {});


