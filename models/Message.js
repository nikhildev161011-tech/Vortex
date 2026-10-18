const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  room: { type: String, required: true },
  sender: { type: String, required: true },
  message: { type: String, default: '' },
  type: { type: String, default: 'text' },
  time: { type: String, default: 'Just now' },
  replyTo: { type: String, default: null },
  fileUrl: { type: String, default: '' },
  fileName: { type: String, default: '' },
  fileSize: { type: String, default: '' },
  mapUrl: { type: String, default: '' },
  duration: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Message', messageSchema);