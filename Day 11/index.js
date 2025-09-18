const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();
const PORT = 3000;

// MongoDB connection
const mongoUrl = "mongodb://localhost:27017";
const dbName = "resumeData";
let db;

// Middleware
app.use(express.json());


function checkDbConnection(res) {
  if (!db) {
    return res.status(503).json({ success: false, error: "Database not connected" });
  }
  return true;
}


// CREATE - Add a new project
app.post("/api/projects", async (req, res) => {
  if (!checkDbConnection(res)) return;
  try {
    const result = await db.collection("projects").insertOne(req.body);
    res.json({ success: true, insertedId: result.insertedId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// READ - Get all projects
app.get("/api/projects", async (req, res) => {
  if (!checkDbConnection(res)) return;
  try {
    const projects = await db.collection("projects").find().toArray();
    res.json({ success: true, data: projects });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// READ (single project by ID)
app.get("/api/projects/:id", async (req, res) => {
  if (!checkDbConnection(res)) return;
  try {
    const project = await db.collection("projects").findOne({ _id: new ObjectId(req.params.id) });
    if (!project) return res.status(404).json({ success: false, error: "Project not found" });
    res.json({ success: true, data: project });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// UPDATE - Modify project by ID
app.put("/api/projects/:id", async (req, res) => {
  if (!checkDbConnection(res)) return;
  try {
    const result = await db.collection("projects").updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: req.body }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }
    res.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE - Remove project by ID
app.delete("/api/projects/:id", async (req, res) => {
  if (!checkDbConnection(res)) return;
  try {
    const result = await db.collection("projects").deleteOne({ _id: new ObjectId(req.params.id) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }
    res.json({ success: true, deletedCount: result.deletedCount });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- Connect to MongoDB and Start Server ---
MongoClient.connect(mongoUrl)
  .then((client) => {
    db = client.db(dbName);
    app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}/api/projects`));
  })
  .catch((err) => console.error("MongoDB connection failed:", err));
