const express = require("express");
const router = express.Router();
const db = require("../db/db");

function sendNotificationToClient(wsClients, recipientId, notification) {
  const client = wsClients.get(recipientId);
  if (client && client.readyState === 1) {
    client.send(JSON.stringify(notification));
  }
}

// 🚀 Get following list for a user
router.get("/following/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const following = await db.all(
      `SELECT following_id FROM followers WHERE follower_id = ?`,
      [userId]
    );

    res.status(200).json({
      status: 200,
      message: "Following list fetched successfully",
      data: {
        success: following,
      },
    });
  } catch (err) {
    res.status(500).json({
      status: 500,
      message: "Failed to fetch following list",
      data: {
        failure: err.message,
      },
    });
  }
});

// 👥 Follow user
router.post("/users/:userId/follow/:targetId", async (req, res) => {
  try {
    const { userId, targetId } = req.params;

    await db.run(
      `INSERT OR IGNORE INTO followers (follower_id, following_id) VALUES (?, ?)`,
      [userId, targetId]
    );

    const message = `${userId} started following you`;

    await db.run(
      `INSERT INTO notifications (sender_id, recipient_id, type, message) VALUES (?, ?, ?, ?)`,
      [userId, targetId, "FOLLOW", message]
    );

    const wsClients = req.app.get("wsClients");
    sendNotificationToClient(wsClients, targetId, {
      senderId: userId,
      recipientId: targetId,
      type: "FOLLOW",
      message,
      createdAt: new Date(),
    });
    res.status(200).json({
      status: 200,
      message: "User followed successfully",
      data: {
        success: true,
      },
    });
  } catch (err) {
    res.status(500).json({
      status: 500,
      message: "Failed to follow user",
      data: {
        failure: err.message,
      },
    });
  }
});

// 👥 unfollow user
router.post("/users/:userId/unfollow/:targetId", async (req, res) => {
  try {
    const { userId, targetId } = req.params;

    // Delete the follower relationship
    await db.run(
      `DELETE FROM followers WHERE follower_id = ? AND following_id = ?`,
      [userId, targetId]
    );

    const message = `${userId} unfollowed you`;

    await db.run(
      `INSERT INTO notifications (sender_id, recipient_id, type, message) VALUES (?, ?, ?, ?)`,
      [userId, targetId, "UNFOLLOW", message]
    );
    const wsClients = req.app.get("wsClients");
    sendNotificationToClient(wsClients, targetId, {
      senderId: userId,
      recipientId: targetId,
      type: "UNFOLLOW",
      message,
      createdAt: new Date(),
    });

    res.status(200).json({
      status: 200,
      message: "User unfollowed successfully",
      data: {
        success: true,
      },
    });
  } catch (err) {
    res.status(500).json({
      status: 500,
      message: "Failed to unfollow user",
      data: {
        failure: err.message,
      },
    });
  }
});

// ✏️ Create post and notify followers
router.post("/posts", async (req, res) => {
  try {
    const { userId, content } = req.body;

    const result = await db.run(
      `INSERT INTO posts (user_id, content) VALUES (?, ?)`,
      [userId, content]
    );
    const postId = result.lastID;

    const followers = await db.all(
      `SELECT follower_id FROM followers WHERE following_id = ?`,
      [userId]
    );

    const wsClients = req.app.get("wsClients");

    for (const follower of followers) {
      const message = `${userId} posted: ${content}`;
      await db.run(
        `INSERT INTO notifications (sender_id, recipient_id, type, message) VALUES (?, ?, ?, ?)`,
        [userId, follower.follower_id, "NEW_POST", message]
      );

      sendNotificationToClient(wsClients, follower.follower_id, {
        senderId: userId,
        recipientId: follower.follower_id,
        type: "NEW_POST",
        message,
        createdAt: new Date(),
      });
    }

    res.status(201).json({
      status: 201,
      message: "Post created and followers notified",
      data: {
        success: {
          postId,
          notifiedFollowers: followers.map((f) => f.follower_id),
        },
      },
    });
  } catch (err) {
    res.status(500).json({
      status: 500,
      message: "Failed to create post",
      data: {
        failure: err.message,
      },
    });
  }
});

// Get posts from users the user follows
router.get("/following-posts/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // Get list of user IDs the current user follows
    const following = await db.all(
      `SELECT following_id FROM followers WHERE follower_id = ?`,
      [userId]
    );
    const followingIds = following.map((f) => f.following_id);

    if (followingIds.length === 0) {
      return res.status(200).json({
        status: 200,
        message: "No following users",
        data: { success: [] },
      });
    }

    // Dynamically build placeholders (?, ?, ...) for SQLite
    const placeholders = followingIds.map(() => "?").join(", ");

    // Get posts from followed users
    const posts = await db.all(
      `SELECT * FROM posts WHERE user_id IN (${placeholders}) ORDER BY created_at DESC`,
      followingIds
    );

    res.status(200).json({
      status: 200,
      message: "Posts from followed users fetched successfully",
      data: {
        success: posts,
      },
    });
  } catch (err) {
    res.status(500).json({
      status: 500,
      message: "Failed to fetch following posts",
      data: {
        failure: err.message,
      },
    });
  }
});

// 👍 Like/Dislike a post and notify author
router.post("/posts/:postId/like", async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId, liked } = req.body;

    await db.run(
      `INSERT OR REPLACE INTO likes (post_id, user_id, liked) VALUES (?, ?, ?)`,
      [postId, userId, liked]
    );

    const post = await db.get(`SELECT * FROM posts WHERE id = ?`, [postId]);
    if (!post) {
      return res.status(404).json({
        status: 404,
        message: "Post not found",
        data: {
          failure: "Post not found",
        },
      });
    }

    const message = `${userId} ${liked ? "liked" : "disliked"} your post`;

    await db.run(
      `INSERT INTO notifications (sender_id, recipient_id, type, message) VALUES (?, ?, ?, ?)`,
      [userId, post.user_id, "LIKE", message]
    );

    const wsClients = req.app.get("wsClients");
    sendNotificationToClient(wsClients, post.user_id, {
      senderId: userId,
      recipientId: post.user_id,
      type: "LIKE",
      message,
      createdAt: new Date(),
    });

    res.status(200).json({
      status: 200,
      message: "Reaction saved and author notified",
      data: {
        success: true,
      },
    });
  } catch (err) {
    res.status(500).json({
      status: 500,
      message: "Failed to like/dislike post",
      data: {
        failure: err.message,
      },
    });
  }
});

module.exports = router;
