require('dotenv').config();
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const path = require('path');

const app = express();
const server = http.createServer(app);

// --- 1. CONFIGURATION ---
const API_KEY = process.env.GEMINI_API_KEY; 
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// --- 2. SERVE THE WEBSITE (The part you were missing!) ---
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- 3. CHAT SERVER ---
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
    console.log("New client connected!");

    ws.on('message', async (message) => {
        let userPost;
        try { userPost = JSON.parse(message); } catch (e) { return; }
        
        broadcast(userPost); // Show user question immediately

        try {
            if (!API_KEY) throw new Error("No API Key");
            
            // AI Reply
            const result = await model.generateContent(`
                You are a helpful tutor. 
                Question: "${userPost.content}"
                Keep answer short (max 2 sentences).
            `);
            const response = await result.response;
            sendAiResponse(response.text());

        } catch (error) {
            console.error("AI Error:", error.message);
            setTimeout(() => sendAiResponse("Thinking is hard right now... try again later!"), 1000);
        }

        function sendAiResponse(text) {
            broadcast({
                id: Date.now() + 1,
                author: "Gemini AI",
                role: "AI Tutor",
                title: "Answer",
                content: text,
                likes: 0, replies: 0, time: "Just now", isSolved: true, avatar: "🤖"
            });
        }
    });
});

function broadcast(data) {
    wss.clients.forEach((client) => {
        if (client.readyState === 1) client.send(JSON.stringify(data));
    });
}

// Start the server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
