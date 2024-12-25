import express from "express";
import session from "express-session";
import mongoSession from "connect-mongodb-session";
import cors from "cors";
import mongoose from "mongoose";
import bodyParser from "body-parser";
import path from "path";
import http, { request } from "http";
import { Server } from "socket.io";
import ExpressMongoSanitize from "express-mongo-sanitize";
import HTTPError from "./models/http-error.js";
import { fileURLToPath } from "url";
import { dirname } from "path";
import userRoutes from "./routes/user-routes.js";
import "dotenv/config";
import User from "./models/user.js";
import Room from "./models/room.js";
import Match from "./models/match.js";
import { SocketAddress } from "net";
import roomsRoutes from "./routes/rooms-routes.js";
import { ObjectId } from "mongodb";
import MatchUser from "./models/matchUserSchema.js";
import he from "he";

const main = async () => {
  const mongoDbStore = mongoSession(session);

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  const app = express();
  const server = http.createServer(app);

  const triviaStore = new mongoDbStore({
    uri: process.env.MONGODB_URI,
    collection: "sessions",
  });

  app.set("trust proxy", 1);

  app.use(
    cors({
      origin: [
        process.env.CORS_ORIGIN_DEV,
        process.env.CORS_ORIGIN,
        "https://rocket-group-project-2024.vercel.app",
      ],
      credentials: true,
    })
  );

  const ExpressSessionMiddlewareCookies = session({
    name: "cookieID",
    store: triviaStore,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 30, //30 days
      secure: process.env.NODE_ENV == "production" ? true : false,
      httpOnly: process.env.NODE_ENV == "production" ? true : false,
      domain:
        process.env.NODE_ENV == "production"
          ? "trivia.planetearthlawncare.org"
          : undefined,
      sameSite: process.env.NODE_ENV == "production" ? "none" : "lax",
    },
    resave: false,
    saveUninitialized: false,
    secret: process.env.TRIVIA_GAME_AUTH_KEY,
  });

  app.use(express.json());
  app.use(ExpressSessionMiddlewareCookies);
  app.use(bodyParser.json());
  app.use(ExpressMongoSanitize());

  // Serve Socket.IO client
  app.use(
    "/socket.io",
    express.static(path.join(__dirname, "node_modules/socket.io/client-dist"))
  );

  app.use("/trivia/user", userRoutes);
  app.use("/trivia/rooms", roomsRoutes);

  const wrap = (middleware) => (socket, next) =>
    middleware(socket.request, {}, next);

  const io = new Server(server, {
    cors: {
      origin:
        process.env.NODE_ENV == "production"
          ? process.env.CORS_ORIGIN
          : process.env.CORS_ORIGIN_DEV,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.use(wrap(ExpressSessionMiddlewareCookies));

  io.use(async (socket, next) => {
    try {
      const sessionID = socket.request.session.userId;
      if (!sessionID) {
        throw new HTTPError("Authentication Required", 403);
      }

      next();
    } catch {
      next(new HTTPError("Authentication Required", 403));
    }
  });

  io.on("connection", (socket) => {
    socket.on("joinRoom", async (roomId) => {
      try {
        const user = await User.findOne({ _id: socket.request.session.userId });

        if (!user) {
          return next(
            new HTTPError(
              "User doesn't exist. Please try logging in again.",
              403
            )
          );
        }

        const checkGameStarted = await Room.findOne({ _id: roomId });

        const checkIfJoined = await Room.findOne({
          $and: [
            {
              users: { $in: socket.request.session.userId },
            },
            { _id: roomId },
          ],
        });

        if (checkGameStarted.inProgress && !checkIfJoined) {
          socket.emit(
            "error",
            "The game has already started before you joined. Please join another game."
          );
          return;
        } else if (!checkIfJoined) {
          const room = await Room.findOneAndUpdate(
            { _id: roomId },
            {
              $push: {
                users: socket.request.session.userId,
              },
            }
          );

          if (!room) {
            socket.emit(
              "error",
              "There was a problem adding you to this room."
            );
          }

          socket.join(roomId);

          io.in(roomId).emit(
            "send-room-joined",
            user._id,
            user.username,
            user.image
          );
        } else {
          socket.join(roomId);

          io.in(roomId).emit(
            "send-room-joined",
            user._id,
            user.username,
            user.image
          );
        }
      } catch (err) {
        console.log(err);

        socket.emit("error", "There was a problem adding you to this room.");
      }
    });

    socket.on("joinMatch", (matchId) => {
      try {
        socket.join(matchId);
      } catch (err) {
        socket.emit("error", "An Unknown Error Occurred.", 500);
      }
    });

    socket.on("endMatch", async (roomId, matchId) => {
      try {
        const room = await Room.findOne({ _id: roomId });

        if (socket.request.session.userId != room.host) {
          return socket.emit(
            "error",
            "You don't have permission to end this game since you are not the host."
          );
        }

        const matchUsers = await MatchUser.find({
          matchId: matchId,
        }).populate("userId");

        await Match.updateOne({ _id: matchId }, { matchOver: true });

        const sortedUsers = [...matchUsers].sort(
          (user1, user2) =>
            user2.userId.correctAnswers - user1.userId.correctAnswers
        );

        const midIndex = Math.floor(sortedUsers.length / 2);

        const winners = sortedUsers.slice(0, midIndex);
        const losers = sortedUsers.slice(midIndex);

        for (let user of winners) {
          await User.updateOne(
            { _id: user.userId._id },
            { totalWins: user.userId.totalWins + 1 }
          );
        }

        for (let user of losers) {
          await User.updateOne(
            { _id: user.userId._id },
            { totalLosses: user.userId.totalLosses + 1 }
          );
        }

        if (!room) {
          return socket.emit("error", "Couldn't find room");
        } else {
          await Room.deleteOne({ _id: roomId });
        }

        return io.in(matchId).emit("send-go-to-lobby");
      } catch (err) {
        console.log(err);
      }
    });

    socket.on("answerQuestion", async (matchId, answer) => {
      try {
        const user = await User.findOne({ _id: socket.request.session.userId });

        if (!user) {
          return socket.emit("error", "We couldn't find your user");
        }

        const match = await Match.findOne({ _id: matchId });

        const matchUser = await MatchUser.findOne({
          $and: [{ userId: socket.request.session.userId, matchId: matchId }],
        });

        if (!match) {
          return;
        }

        if (matchUser.currentQuestionNumber >= match.numberOfQuestions) {
          return socket.emit(
            "error",
            "You have already answered all of the questions. Please wait for the host to end the game."
          );
        }

        const question = match.questions[matchUser.currentQuestionNumber];

        const newAnswers = [...matchUser.answers, answer];

        const answerStatus = answer == he.decode(question.correct_answer);

        if (answerStatus) {
          await MatchUser.updateOne(
            {
              _id: matchUser._id,
            },
            {
              currentQuestionNumber: matchUser.currentQuestionNumber + 1,
              correctAnswers: matchUser.correctAnswers + 1,
              answers: newAnswers,
            }
          );
        } else {
          await MatchUser.updateOne(
            {
              _id: matchUser._id,
            },
            {
              currentQuestionNumber: matchUser.currentQuestionNumber + 1,
              answers: newAnswers,
            }
          );
        }

        io.in(matchId).emit("questionResult", user._id, answerStatus);

        if (matchUser.currentQuestionNumber + 1 < match.numberOfQuestions) {
          socket.emit("nextQuestion", {
            question:
              match.questions[matchUser.currentQuestionNumber + 1].question,
            answers: [
              ...match.questions[matchUser.currentQuestionNumber + 1]
                .incorrect_answers,
              match.questions[matchUser.currentQuestionNumber + 1]
                .correct_answer,
            ],
            category:
              match.questions[matchUser.currentQuestionNumber + 1].category,
            difficulty:
              match.questions[matchUser.currentQuestionNumber + 1].difficulty,
          });
        }
      } catch (err) {
        console.log(err);
        return socket.emit(
          "error",
          "unkown error occurred when trying to answer this question.",
          500
        );
      }
    });

    socket.on(
      "startMatch",
      async (rId, numberOfQuestions, category, difficulty) => {
        try {
          let trivia_categories = [
            { id: 9, name: "General Knowledge" },
            { id: 10, name: "Entertainment: Books" },
            { id: 11, name: "Entertainment: Film" },
            { id: 12, name: "Entertainment: Music" },
            { id: 13, name: "Entertainment: Musicals & Theatres" },
            { id: 14, name: "Entertainment: Television" },
            { id: 15, name: "Entertainment: Video Games" },
            { id: 16, name: "Entertainment: Board Games" },
            { id: 17, name: "Science & Nature" },
            { id: 18, name: "Science: Computers" },
            { id: 19, name: "Science: Mathematics" },
            { id: 20, name: "Mythology" },
            { id: 21, name: "Sports" },
            { id: 22, name: "Geography" },
            { id: 23, name: "History" },
            { id: 24, name: "Politics" },
            { id: 25, name: "Art" },
            { id: 26, name: "Celebrities" },
            { id: 27, name: "Animals" },
            { id: 28, name: "Vehicles" },
            { id: 29, name: "Entertainment: Comics" },
            { id: 30, name: "Science: Gadgets" },
            { id: 31, name: "Entertainment: Japanese Anime & Manga" },
            { id: 32, name: "Entertainment: Cartoon & Animations" },
          ];
          const roomId = rId;

          const room = await Room.findOneAndUpdate(
            { _id: rId },
            { inProgress: true }
          );
          if (socket.request.session.userId != room.host) {
            const error = new HTTPError("Unauthorized to Start Match", 403);
            return next(error);
          }

          let response;

          if (category != "Random") {
            let objLookup = trivia_categories.find(
              (cat) => cat.name == category
            );

            if (difficulty != "Any") {
              response = await fetch(
                `https://opentdb.com/api.php?amount=${numberOfQuestions}&category=${objLookup.id}&difficulty=${difficulty}`
              );
            } else {
              response = await fetch(
                `https://opentdb.com/api.php?amount=${numberOfQuestions}&category=${objLookup.id}`
              );
            }
          } else {
            if (difficulty != "Any") {
              response = await fetch(
                `https://opentdb.com/api.php?amount=${numberOfQuestions}&difficulty=${difficulty}`
              );
            } else {
              response = await fetch(
                `https://opentdb.com/api.php?amount=${numberOfQuestions}`
              );
            }
          }

          const triviaData = await response.json();

          let questionObj = [];

          for (let i = 0; i < triviaData["results"].length; i++) {
            questionObj[i] = {
              question: triviaData["results"][i]["question"],
              correct_answer: triviaData["results"][i]["correct_answer"],
              incorrect_answers: triviaData["results"][i]["incorrect_answers"],
              category: triviaData["results"][i]["category"],
              difficulty: triviaData["results"][i]["difficulty"],
            };
          }

          const matchUsers = [];

          let newUser;

          const match = new Match({
            roomId: roomId,
            questions: questionObj,
            category: category,
            difficulty: difficulty,
            numberOfQuestions: numberOfQuestions,
          });

          await match.save();

          for (let user of room.users) {
            newUser = new MatchUser({ userId: user, matchId: match._id });

            await newUser.save();

            matchUsers.push(newUser);
          }

          socket.join(match._id);

          io.in(roomId).emit("send-go-to-game", match._id);
        } catch (err) {
          console.log(err);

          socket.emit("error", "Unable to Create the Match.", 500);
        }
      }
    );
  });

  // Error handling middleware
  app.use((error, req, res, next) => {
    if (res.headerSent) {
      return next(error);
    }
    res.status(error.code || 500);
    res.json({ message: error.message || "An unknown error occurred!" });
  });

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    server.listen(parseInt(process.env.PORT), () => {
      console.log(`Server started on http://localhost:${process.env.PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
  }
};

main().catch((err) => {
  console.error("Main function error:", err);
});
