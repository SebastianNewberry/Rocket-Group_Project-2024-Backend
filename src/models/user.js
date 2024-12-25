import mongoose from "mongoose";
const Schema = mongoose.Schema;

const userSchema = new Schema({
  username: { type: String, required: true, unique: true },
  image: { type: String, required: false },
  totalWins: { type: Number, required: true, default: 0 },
  totalLosses: { type: Number, required: true, default: 0 },
});

export default mongoose.model("User", userSchema);
