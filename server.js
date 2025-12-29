const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

let queue = [];

io.on("connection", (socket) => {
  console.log("🟢 Connected:", socket.id);

  socket.on("ready", () => {
    console.log("✅ Ready received from:", socket.id);
    queue.push(socket);
    console.log("📦 Queue size:", queue.length);

    if (queue.length >= 2) {
      const user1 = queue.shift();
      const user2 = queue.shift();

      user1.partner = user2;
      user2.partner = user1;

      console.log("🔗 Matched:", user1.id, "↔", user2.id);

      user1.emit("create-offer");
      user2.emit("wait-offer");
    }
  });

  socket.on("signal", (data) => {
    console.log("📡 Signal from:", socket.id, Object.keys(data));
    socket.partner?.emit("signal", data);
  });


   // Chat message
   socket.on("chat-message", (msg) => {
    console.log(`💬 Message from ${socket.id}:`, msg);
    // Send message to partner if exists
    socket.partner?.emit("chat-message", msg);
  });

  socket.on("disconnect", () => {
    console.log("🔴 Disconnected:", socket.id);
    queue = queue.filter(s => s.id !== socket.id);
    socket.partner?.emit("partner-left");
  });
});

server.listen(PORT, () =>
  console.log("🚀 Server running on port 5000")
);
