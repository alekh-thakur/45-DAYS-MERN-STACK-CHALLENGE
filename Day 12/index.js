const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();
const PORT = 3000;

const mongoUrl = "mongodb://localhost:27017";
const dbName = "BlogPost";
let db;

app.use(express.json());

// Check DB connection
function checkDbConnect(res) {
  if (!db) {
    return res.status(503).json({ success: false, error: "Database not connected" });
  }
  return true;
}

// CREATE - Add new post
app.post("/api/posts", async (req, res) => {
  if (!checkDbConnect(res)) return;
  try {
    const result = await db.collection("posts").insertOne(req.body);

    res.json({
      success: true,
      insertedId: result.insertedId.toString(), // return string ID
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// READ - Get all posts
app.get("/api/posts", async (req, res) => {
  if (!checkDbConnect(res)) return;
  try {
    const posts = await db.collection("posts").find().toArray();

    // Convert ObjectId to string
    const formatted = posts.map((post) => ({
      ...post,
      _id: post._id.toString(),
    }));

    res.json({ success: true, data: formatted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// READ - Get single post by ID
app.get("/api/posts/:id", async (req, res) => {
  if (!checkDbConnect(res)) return;
  try {
    const post = await db.collection("posts").findOne({ _id: new ObjectId(req.params.id) });
    if (!post) return res.status(404).json({ success: false, error: "Post not found" });

    res.json({
      success: true,
      data: { ...post, _id: post._id.toString() },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// UPDATE - Modify post by ID
app.put("/api/posts/:id", async (req, res) => {
  if (!checkDbConnect(res)) return;
  try {
    const result = await db.collection("posts").updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: req.body }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, error: "Post not found" });
    }

    res.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE - Remove post by ID
app.delete("/api/posts/:id", async (req, res) => {
  if (!checkDbConnect(res)) return;
  try {
    const result = await db.collection("posts").deleteOne({ _id: new ObjectId(req.params.id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, error: "Post not found" });
    }

    res.json({ success: true, deletedCount: result.deletedCount });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// CONNECT to MongoDB & start server
MongoClient.connect(mongoUrl)
  .then((client) => {
    db = client.db(dbName);
    app.listen(PORT, () =>
      console.log(`🚀 Server running on http://localhost:${PORT}/api/posts`)
    );
  })
  .catch((err) => console.error("MongoDB connection failed:", err));
