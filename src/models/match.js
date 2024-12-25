import mongoose from "mongoose";
const Schema = mongoose.Schema;

const match = new Schema({
  questions: [
    {
      question: { type: String, required: true },
      incorrect_answers: [{ type: String, required: true }],
      correct_answer: { type: String, required: true },
      category: { type: String, required: true },
      difficulty: { type: String, required: true },
    },
  ],
  roomId: {
    type: mongoose.Types.ObjectId,
    required: true,
    ref: "Room",
    unique: true,
  },
  numberOfQuestions: { type: Number, required: true, default: 10 },
  category: { type: String, required: true, default: "random" },
  difficulty: { type: String, required: true, default: "any" },
  matchOver: { type: Boolean, required: true, default: false },
});

export default mongoose.model("Match", match);
