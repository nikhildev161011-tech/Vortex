const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const Message = require('./models/Message');
const User = require('./models/User');

const groupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  members: { type: [String], default: [] },
  createdBy: { type: String, required: true },
  avatar: { type: String, default: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&auto=format&fit=crop&q=80' },
  createdAt: { type: Date, default: Date.now }
});
const Group = mongoose.models.Group || mongoose.model('Group', groupSchema);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const server = http.createServer(app);

if (process.env.MONGO_URI) {
  mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Connected to MongoDB successfully'))
    .catch((err) => console.error('MongoDB connection error:', err));
} else {
  console.warn('MONGO_URI missing in .env file!');
}

// API to register or save a user in MongoDB
app.post('/api/register', async (req, res) => {
  try {
    const { phoneNumber, name, avatar } = req.body;
    if (!phoneNumber || !name) {
      return res.status(400).json({ success: false, message: 'Phone number and name are required' });
    }

    const updatedUser = await User.findOneAndUpdate(
      { phoneNumber },
      { name, avatar: avatar || 'https://via.placeholder.com/150' },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({ success: true, user: updatedUser });
  } catch (err) {
    console.error('Error registering user:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// API to check if a phone number exists on Vortex Database
app.post('/api/check-user', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    const user = await User.findOne({ phoneNumber });
    if (user) {
      res.status(200).json({ exists: true, user });
    } else {
      res.status(404).json({ exists: false, message: 'User not found on Vortex' });
    }
  } catch (err) {
    console.error('Error checking user:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// API to update user profile (Avatar, Name, About)
app.post('/api/update-profile', async (req, res) => {
  try {
    const { phoneNumber, name, avatar, about } = req.body;
    const updatedUser = await User.findOneAndUpdate(
      { phoneNumber },
      { name, avatar, about },
      { new: true }
    );
    
    if (updatedUser) {
      res.status(200).json({ success: true, user: updatedUser });
    } else {
      res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// API to create a new group
app.post('/api/create-group', async (req, res) => {
  try {
    const { name, members, createdBy, avatar } = req.body;
    const newGroup = new Group({
      name,
      members: members || [],
      createdBy,
      avatar: avatar || 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&auto=format&fit=crop&q=80'
    });
    await newGroup.save();
    res.status(200).json({ success: true, group: newGroup });
  } catch (err) {
    console.error('Error creating group:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// API to fetch groups for a specific user phone number
app.get('/api/groups/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    const groups = await Group.find({ members: { $in: [phone] } });
    res.status(200).json(groups);
  } catch (err) {
    console.error('Error fetching groups:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// API to get chat history for a room
app.get('/api/messages/:room', async (req, res) => {
  try {
    const { room } = req.params;
    const history = await Message.find({ room }).sort({ timestamp: 1 });
    res.status(200).json(history);
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  maxHttpBufferSize: 1e8
});

io.on('connection', (socket) => {
  console.log(`A user connected: ${socket.id}`);

  socket.on('join_room', (room) => {
    socket.join(room);
    console.log(`Socket ${socket.id} joined room: "${room}"`);
  });

  socket.on('send_message', async (data) => {
    try {
      socket.broadcast.to(data.room).emit('receive_message', data);
      const newMessage = new Message({
        room: data.room,
        sender: data.sender,
        message: data.message || '',
        type: data.type || 'text',
        fileUrl: data.fileUrl || '',
        fileName: data.fileName || '',
        fileSize: data.fileSize || '',
        mapUrl: data.mapUrl || '',
        replyTo: data.replyTo || null,
        time: data.time || 'Just now'
      });
      await newMessage.save();
    } catch (err) {
      console.error('Error handling send_message:', err);
    }
  });

  socket.on('delete_message', async ({ messageId, room }) => {
    try {
      io.to(room).emit('message_deleted', messageId);
      if (mongoose.Types.ObjectId.isValid(messageId)) {
        await Message.findByIdAndDelete(messageId);
      }
    } catch (err) {
      console.error('Error deleting message:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log(`Disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Vortex Backend Server running on port ${PORT}`);
});
