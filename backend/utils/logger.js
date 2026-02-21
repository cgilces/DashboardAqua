const pino = require("pino");

const logger = pino({
  level: "info",
  transport: process.env.NODE_ENV !== "production"
    ? {
        target: "pino-pretty",
        options: {
          colorize: true
        }
      }
    : undefined
});

module.exports = logger;