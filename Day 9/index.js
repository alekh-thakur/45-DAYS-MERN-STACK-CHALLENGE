const express = require("express");
const { MongoClient } = require("mongodb");
const app = express();
const PORT = 3000;
// MongoDB connection URL
const mongoUrl = "mongodb://localhost:27017";
const dbName = "resumeData";
let db;
// Async function to handle MongoDB connection
async function connectToMongoDB() {
  const client = new MongoClient(mongoUrl);
  try {
    // Connect to MongoDB
    await client.connect();
    // Log success message
    console.log("✅ Connected successfully to MongoDB");
    // Get database reference
    db = client.db(dbName);
    console.log(`📊 Using database: ${dbName}`);
    // Test the connection with a ping
    await db.admin().ping();
    console.log("🏓 Database ping successful");
    return db;
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
    throw error;
  }
}

app.use(express.json());

app.get("/api/status", (req, res) => {
  res.json({
    message: "MongoDB connection successful!",
    database: dbName,
    status: "connected",
    timestamp: new Date().toISOString(),
  });
});
// Start server after connecting to MongoDB
connectToMongoDB()
  .then(() => {
    app.listen(PORT, () => {
          console.log(`Test your connection: http://localhost:${PORT}/api/status`);
    });
  })
  .catch((error) => {
    console.error(" Failed to start server:", error.message);
    process.exit(1);
  });
