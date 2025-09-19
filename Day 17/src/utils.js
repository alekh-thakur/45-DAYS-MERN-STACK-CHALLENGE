// src/utils.js
function isEmail(email) {
  return /\S+@\S+\.\S+/.test(email);
}

module.exports = { isEmail };
