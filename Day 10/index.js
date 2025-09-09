const express = require("express");
const { MongoClient } = require("mongodb");
const path = require("path");

const app = express();
const PORT = 3000;

// MongoDB connection
const mongoUrl = "mongodb://localhost:27017";
const dbName = "resumeData";
let db;

// Middleware for parsing JSON
app.use(express.json());

// Serve static HTML for testing
app.use(express.static(path.join(__dirname, "public")));

// POST /api/projects - Create new project
app.post("/api/projects", async (req, res) => {
  try {
    const projectData = req.body;
    console.log("📥 Incoming Project Data:", projectData);

    // Validation
    if (!projectData.title || !projectData.description) {
      console.log("❌ Validation failed: missing fields");
      return res.status(400).json({
        success: false,
        error: "Title and description are required",
      });
    }

    // Add timestamps
    projectData.createdAt = new Date();
    projectData.updatedAt = new Date();

    // Insert into MongoDB
    const result = await db.collection("projects").insertOne(projectData);
    console.log("✅ Inserted into MongoDB:", result.insertedId);

    res.status(201).json({
      success: true,
      message: "Project created successfully",
      data: { ...projectData, _id: result.insertedId },
    });
  } catch (error) {
    console.error("🔥 Error inserting project:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create project",
    });
  }
});

// GET /api/projects - Get all projects
app.get("/api/projects", async (req, res) => {
  try {
    const projects = await db.collection("projects").find({}).toArray();
    console.log("📤 Retrieved Projects:", projects.length);
    res.json({
      success: true,
      count: projects.length,
      data: projects,
    });
  } catch (error) {
    console.error("🔥 Error retrieving projects:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve projects",
    });
  }
});

// Connect to MongoDB and start server
MongoClient.connect(mongoUrl)
  .then((client) => {
    db = client.db(dbName);
    console.log("✅ Connected to MongoDB");
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}/api/projects`);
    });
  })
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));
