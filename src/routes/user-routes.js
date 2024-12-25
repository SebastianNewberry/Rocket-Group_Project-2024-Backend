import isAuth from "../middleware/isAuth.js";

import express from "express";

import * as userController from "../controllers/users-controller.js";

const router = express.Router();

router.post("/login", userController.login);

router.post("/register", userController.register);

router.get("/leaderboards", userController.getAllUsers);

router.use(isAuth);

router.post("/updateUser", userController.updateUser);

router.post("/logout", userController.logout);

router.get("/getUser", userController.getUser);

export default router;
