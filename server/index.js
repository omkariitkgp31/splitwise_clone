require('dotenv').config();
require("./src/config/passport");
const http = require('http');
const app = require('./src/app');

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

const io = require('socket.io')(server, {
  cors: {
    origin: process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  },
});

app.set('io', io);

const { socketHandler } = require('./src/socket/socketHandler');
socketHandler(io);

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
