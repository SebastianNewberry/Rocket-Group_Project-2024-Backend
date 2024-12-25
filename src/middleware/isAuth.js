import HTTPError from "../models/http-error.js";

const AuthMiddleware = (req, res, next) => {
  if (req.method === "OPTIONS") {
    console.log("Skipping");
    return next();
  }

  if (req.session && req.session.userId) {
    next();
  } else {
    const error = new HTTPError("Authentication failed! Please login!", 401);
    return next(error);
  }
};

export default AuthMiddleware;
