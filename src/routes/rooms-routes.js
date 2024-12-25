import isAuth from "../middleware/isAuth.js";

import express from "express";

import * as roomsController from "../controllers/rooms-controller.js";

const router = express.Router();

router.get("/get", roomsController.getRooms);

router.use(isAuth);

router.get("/getPlayers", roomsController.getPlayers);

router.post("/create", roomsController.createRoom);

router.get("/firstQuestion", roomsController.getFirstQuestion);

router.get("/allMatchUsers", roomsController.getAllMatchUsers);

router.get("/allMatchAnswers", roomsController.getAllMatchAnswers);

router.get(
  "/getMatchWithoutQuestions",
  roomsController.getMatchWithoutQuestions
);

router.get("/getMatch", roomsController.getMatch);

router.get("/getMatchByRoomId", roomsController.getMatchByRoomId);

export default router;
