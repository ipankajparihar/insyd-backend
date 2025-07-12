// backend/server.js
const express = require("express");
const cors = require("cors");
const http = require("http");
const WebSocket = require("ws");

const { initDB } = require("./db/db");
const notificationsRouter = require("./routes/notification");
const socialRouter = require("./routes/social");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const wsClients = new Map();
app.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`
    );
  });

  next();
});
app.use(cors({ origin: "*" }));

app.use(express.json());
app.use("/notifications", notificationsRouter);
app.use("/social", socialRouter);

wss.on("connection", (ws) => {
  ws.on("message", (msg) => {
    const { userId } = JSON.parse(msg);
    wsClients.set(userId, ws);
  });

  ws.on("close", () => {
    for (const [key, client] of wsClients.entries()) {
      if (client === ws) wsClients.delete(key);
    }
  });
});

app.set("wsClients", wsClients);

initDB().then(() => {
  server.listen(4000, () => {
    console.log("✅ Backend running on http://localhost:4000");
  });
});
