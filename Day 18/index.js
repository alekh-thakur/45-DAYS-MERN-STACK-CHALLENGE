// index.js
import express from "express";
import dotenv from "dotenv";

dotenv.config(); // loads variables from .env

const app = express();
app.use(express.json());

// Health check (good for monitoring)
app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// Example API route
app.get("/api/v1/hello", (req, res) => {
  res.json({ message: "Hello, Enterprise API!" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
