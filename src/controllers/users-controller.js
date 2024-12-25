import User from "../models/user.js";
import HTTPError from "../models/http-error.js";

export const register = async (req, res, next) => {
  try {
    const { username, imageUrl } = req.body;

    const user = new User({
      username: username,
      image: imageUrl,
    });

    try {
      const newUser = await user.save();
      req.session.userId = newUser._id.toString();
    } catch (err) {
      console.log(err);
      const error = new HTTPError("Signing up failed. Please try again!", 500);
      return next(error);
    }

    return res.status(201).json({ success: true });
  } catch (err) {
    console.log(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const { username } = req.body;

    const user = await User.findOne({ username: username });

    if (!user) {
      const error = new HTTPError(
        "Could not find username. Please try again!",
        404
      );
      return next(error);
    } else {
      req.session.userId = user._id.toString();
      return res.status(201).json({ success: true });
    }
  } catch (err) {
    console.log(err);
  }
};

export const getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.session.userId);
    return res.json({ user: user });
  } catch (err) {
    const error = new HTTPError("Internal Server Error", 500);
    return next(error);
  }
};

export const logout = async (req, res, next) => {
  try {
    req.session.destroy((err) => {
      res.clearCookie("cookieID");
      if (err) {
        console.log(err);
        return res.status(500).json({ success: false });
      }
      return res.status(200).json({ success: true });
    });
  } catch (err) {
    console.log(err);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.session.userId);

    if (!user) {
      const error = new HTTPError("User not found", 404);

      return next(error);
    }

    const information = req.body;

    await User.updateOne(
      { _id: req.session.userId },
      {
        username: information.username,
        image: information.imageUrl,
      }
    );

    return res.status(200).json({ success: true });
  } catch (err) {
    console.log(err);
  }
};

export const getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find();

    return res.json({ users: users });
  } catch (err) {
    console.log(err);
  }
};
