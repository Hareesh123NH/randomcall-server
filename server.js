const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

// const WebSocket = require("ws"); // To connect to Python Whisper
// const fs = require("fs");
// const { exec } = require("child_process");
// const path = require("path");


// // Connect to Python Whisper server
// const whisperSocket = new WebSocket("ws://localhost:8765");

// whisperSocket.on("open", () => {
//     console.log("🟢 Connected to local Whisper server");
// });


const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*" },
});

let queue = [];

const matchUsers = () => {
    let i = 0;
    while (i < queue.length - 1) {
        const user1 = queue[i];
        let foundMatch = false;

        for (let j = i + 1; j < queue.length; j++) {
            const user2 = queue[j];

            // Prevent self-match
            if (user1.id === user2.id) continue;

            // Prevent matching with a previous partner
            if (user1.previousPartners && user1.previousPartners.has(user2.id)) continue;
            if (user2.previousPartners && user2.previousPartners.has(user1.id)) continue;

            // Initialize previousPartners if not present
            if (!user1.previousPartners) user1.previousPartners = new Set();
            if (!user2.previousPartners) user2.previousPartners = new Set();

            // Record this match to prevent future reconnections with the same person
            user1.previousPartners.add(user2.id);
            user2.previousPartners.add(user1.id);

            user1.partner = user2;
            user2.partner = user1;

            console.log("🔗 Matched:", user1.id, "↔", user2.id);

            // Remove both from queue (remove highest index first so indices don't shift)
            queue.splice(j, 1);
            queue.splice(i, 1);

            foundMatch = true;

            setTimeout(() => {
                user1.emit("create-offer");
                user2.emit("wait-offer");
            }, 800);

            break; // Break inner loop to continue matching remaining users in the queue
        }

        // If no valid partner was found for user1, advance `i` to try the next user in the queue
        if (!foundMatch) {
            i++;
        }
    }
};

io.on("connection", (socket) => {
    console.log("🟢 Connected:", socket.id);

    socket.on("ready", () => {

        console.log("✅ Ready received from:", socket.id);
        // Prevent duplicate entries
        if (queue.find(s => s.id === socket.id)) {
            console.log("⚠️ Socket already in queue:", socket.id);
            return;
        }

        queue.push(socket);
        console.log("📦 Queue size:", queue.length);

        matchUsers();
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


    socket.on("switch", () => {
        console.log("🔄 Switch requested by:", socket.id);
        
        if (socket.partner) {
            const partner = socket.partner;
            
            // Clear relationship to safely disconnect them
            socket.partner = null;
            partner.partner = null;
            
            // Notify partner that this user left
            partner.emit("partner-left");
            
            // Add partner back to queue
            if (!queue.find(s => s.id === partner.id)) {
                queue.push(partner);
                console.log(`♻️ Added partner ${partner.id} back to queue after switch. Queue size: ${queue.length}`);
            }
        }
        
        // Add the user who clicked switch back to queue
        if (!queue.find(s => s.id === socket.id)) {
            queue.push(socket);
            console.log(`♻️ Added switching user ${socket.id} back to queue. Queue size: ${queue.length}`);
        }
        
        // Attempt to match users again
        matchUsers();
    });

    socket.on("disconnect", () => {
        console.log("🔴 Disconnected:", socket.id);
        queue = queue.filter(s => s.id !== socket.id);
        
        if (socket.partner) {
            socket.partner.emit("partner-left");
            
            const remainingUser = socket.partner;
            remainingUser.partner = null;
            
            if (!queue.find(s => s.id === remainingUser.id)) {
                queue.push(remainingUser);
                console.log(`♻️ Added remaining user ${remainingUser.id} back to queue. Queue size: ${queue.length}`);
                matchUsers();
            }
        }
    });


    socket.on("camera-toggle", state => {
        socket.broadcast.emit("remote-camera-toggle", state);
    });

    socket.on("subtitle", (text) => {
        console.log(`💬 text from ${socket.id}:`, text);
        // Send message to partner if exists
        socket.partner?.emit("subtitle", text);
    });



});

server.listen(5000, () =>
    console.log("🚀 Server running on port 5000")
);
