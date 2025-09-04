const Discussion = require("../models/Discussion");
const Reply = require("../models/Reply");

exports.postReply = async (req, res) => {
  try {
    const { discussionId, content } = req.body;

    if (!discussionId || !content) {
      return res
        .status(400)
        .json({ message: "Discussion ID and content are required" });
    }

    // Check if discussion exists
    const discussion = await Discussion.findById(discussionId);
    if (!discussion) {
      return res.status(404).json({ message: "Discussion not found" });
    }

    const reply = await Reply.create({
      discussion: discussionId,
      content: content,
      createdBy: req.user._id,
    });

    // Broadcast via socket
    const io = req.app.get("io");
    if (io) io.emit("newReply", reply);

    res.status(201).json(reply);
  } catch (err) {
    console.error("Error posting reply:", err);
    res.status(500).json({ message: "Failed to post reply" });
  }
};

exports.getRepliesForDiscussion = async (req, res) => {
  try {
    const { discussionId } = req.params;

    const replies = await Reply.find({ discussion: discussionId })
      .populate("createdBy", "firstName lastName avatarUrl")
      .sort({ createdAt: 1 });

    res.status(200).json(replies);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch replies" });
  }
};
