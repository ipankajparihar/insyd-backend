// backend/routes/notifications.js
const express = require("express");
const router = express.Router();
const db = require("../db/db");

router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const rows = await db.all(
      `SELECT * FROM notifications WHERE recipient_id = ? ORDER BY created_at DESC`,
      [userId]
    );

    res.status(200).json({
      status: 200,
      message: "Notifications fetched successfully",
      data: {
        success: rows,
      },
    });
  } catch (error) {
    res.status(500).json({ 
      status: 500,
      message: "Error fetching notifications",
      data: {
        failure: error.message,
      },
    });
  }
});

router.post("/", async (req, res) => {
  const { senderId, recipientId, type, message } = req.body;

  try {
    await db.run(
      `INSERT INTO notifications (sender_id, recipient_id, type, message) VALUES (?, ?, ?, ?)`,
      [senderId, recipientId, type, message]
    );

    const wsClients = req.app.get("wsClients");
    const client = wsClients.get(recipientId);
    if (client && client.readyState === 1) {
      client.send(
        JSON.stringify({
          senderId,
          recipientId,
          type,
          message,
          createdAt: new Date(),
        })
      );
    }

    res.status(201).json({
      status: 201,
      message: "Notification created successfully",
      data: {
        success: true,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: "Error creating notification",
      data: {
        failure: error.message,
      },
    });
  }
});

module.exports = router;
