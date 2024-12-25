import HTTPError from "../models/http-error.js";
import Match from "../models/match.js";
import Room from "../models/room.js";
import MatchUser from "../models/matchUserSchema.js";

export const createRoom = async (req, res, next) => {
  try {
    const name = req.body.name;
    const createdRoom = new Room({
      GameStarted: false,
      users: [],
      host: req.session.userId,
      name: name,
    });

    await createdRoom.save();

    return res.json({ success: true });
  } catch (err) {
    console.log(err);
  }
};

export const getPlayers = async (req, res, next) => {
  try {
    const roomId = req.query.roomId;

    const room = await Room.findOne({ _id: roomId }).populate("users");

    if (!room) {
      const error = new HTTPError("Room Could not be found", 404);
      return next(error);
    }

    const playerInfo = room.users.map((user) => ({
      username: user.username,
      userId: user._id,
      userImage: user.image,
    }));

    return res.json({
      roomName: room.name,
      playerInfo: playerInfo,
      host: room.host,
    });
  } catch (err) {
    const error = new HTTPError("Room Could not be found", 404);
    return next(error);
  }
};

export const getRooms = async (req, res, next) => {
  try {
    const rooms = await Room.find().populate("users");

    return res.json({ rooms: rooms });
  } catch (err) {
    console.log(err);
  }
};

export const getAllMatchUsers = async (req, res, next) => {
  try {
    const allMatchUsers = await MatchUser.find({
      matchId: req.query.matchId,
    }).populate("userId");

    const listOfUsers = [];

    for (let user of allMatchUsers) {
      listOfUsers.push({
        userInformation: user.userId,
        correctAnswers: user.correctAnswers,
        currentQuestionNumber: user.currentQuestionNumber,
      });
    }

    return res.json({ userCorrectAnswers: listOfUsers });
  } catch (err) {
    console.log(err);
    const error = new HTTPError(
      "Couldn't find a match with this ID. Please try again.",
      404
    );
    return next(error);
  }
};

export const getAllMatchAnswers = async (req, res, next) => {
  try {
    const allMatchUsers = await MatchUser.find({
      matchId: req.query.matchId,
    }).populate("userId");

    const listOfUsers = [];

    for (let user of allMatchUsers) {
      listOfUsers.push({
        userInformation: user.userId,
        correctAnswers: user.correctAnswers,
        answers: user.answers,
        currentQuestionNumber: user.currentQuestionNumber,
      });
    }

    return res.json({ userCorrectAnswers: listOfUsers });
  } catch (err) {
    console.log(err);
    const error = new HTTPError(
      "Couldn't find a match with this ID. Please try again.",
      404
    );
    return next(error);
  }
};

export const getFirstQuestion = async (req, res, next) => {
  try {
    const match = await Match.findOne({ _id: req.query.matchId });
    const matchUser = await MatchUser.findOne({
      $and: [{ userId: req.session.userId }, { matchId: req.query.matchId }],
    });

    if (matchUser.currentQuestionNumber > match.numberOfQuestions - 1) {
      const error = new HTTPError(
        "You have already answered all questions. Please wait for the host to advance to the next round.",
        409
      );
      return next(error);
    }

    const firstQuestion = match.questions[matchUser.currentQuestionNumber];

    return res.json({
      question: firstQuestion.question,
      answers: [
        ...firstQuestion.incorrect_answers,
        firstQuestion.correct_answer,
      ],
      category: firstQuestion.category,
      difficulty: firstQuestion.difficulty,
    });
  } catch (err) {
    console.log(err);
    const error = new HTTPError(
      "Couldn't find a match with this ID. Please try again.",
      404
    );
    return next(error);
  }
};

export const getMatchWithoutQuestions = async (req, res, next) => {
  try {
    const match = await Match.findOne({ _id: req.query.matchId }).select(
      "-questions"
    );

    return res.json({ match: match });
  } catch (err) {
    console.log(err);
    const error = new HTTPError(
      "Couldn't find a match with this ID. Please try again.",
      404
    );
    return next(error);
  }
};

export const getMatch = async (req, res, next) => {
  try {
    const match = await Match.findOne({ _id: req.query.matchId });
    if (!match.matchOver) {
      const error = new HTTPError(
        "This match hasn't ended yet, so you can't access the answers. Please wait until the host ends the game.",
        401
      );

      return next(error);
    }

    return res.json({ match: match });
  } catch (err) {
    console.log(err);
    const error = new HTTPError(
      "Couldn't find a match with this ID. Please try again.",
      404
    );
    return next(error);
  }
};

export const getMatchByRoomId = async (req, res, next) => {
  try {
    const match = await Match.findOne({ roomId: req.query.roomId }).select(
      "-questions"
    );

    return res.json({ match: match });
  } catch (err) {
    const error = new HTTPError(
      "Couldn't find a match with this ID. Please try again.",
      404
    );
    return next(error);
  }
};
