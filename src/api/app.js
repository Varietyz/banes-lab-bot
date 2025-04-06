// app.js
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const logger = require("../modules/utils/essentials/logger");
const authRoutes = require("./authRoutes");
const allowedOrigins = require("./allowedOrigins");
const {
  webSanitizer,
} = require("../modules/utils/essentials/security/webSanitizer");

const app = express();

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.set("trust proxy", true);

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use((req, res, next) => {
  logger.info(`Incoming request: ${req.method} ${req.originalUrl}`);
  next();
});

app.use(cookieParser());
app.use(express.json());

app.use(webSanitizer);

app.use("/api", authRoutes);

logger.info(`CORS configured for origins: ${allowedOrigins.join(", ")}`);

module.exports = app;
