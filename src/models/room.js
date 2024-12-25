import mongoose from "mongoose";
const Schema = mongoose.Schema;

const room = new Schema({
  GameStarted: { type: Boolean, required: true },
  users: [{ type: mongoose.Types.ObjectId, ref: "User" }],
  host: { type: mongoose.Types.ObjectId, required: true, ref: "User" },
  name: { type: String, required: true },
  inProgress: { type: Boolean, required: true, default: false },
});

export default mongoose.model("Room", room);
