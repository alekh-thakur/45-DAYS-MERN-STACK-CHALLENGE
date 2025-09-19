// src/app.js
const express = require("express");
const { isEmail } = require("./utils.js");

const app = express();
app.use(express.json());

// health check
app.get("/health", (req, res) => res.json({ status: "ok" }));

// register
app.post("/register", (req, res) => {
  const { email } = req.body;
  if (!isEmail(email)) {
    return res.status(400).json({ error: "Invalid email" });
  }
  res.status(201).json({ message: "User registered", email });
});

module.exports = app;
