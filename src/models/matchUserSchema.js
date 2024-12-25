import mongoose from "mongoose";

const Schema = mongoose.Schema;

const matchUser = new Schema({
  answers: [{ type: String, required: false }],
  userId: {
    type: mongoose.Types.ObjectId,
    ref: "User",
    required: true,
  },
  matchId: { type: mongoose.Types.ObjectId, required: true },
  currentQuestionNumber: { type: Number, required: true, default: 0 },
  correctAnswers: { type: Number, required: true, default: 0 },
});

matchUser.index({ userId: 1, matchId: 1 }, { unique: true });

export default mongoose.model("MatchUser", matchUser);
