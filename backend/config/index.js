require("dotenv").config();

function required(name) {
  if (!process.env[name]) {
    throw new Error(`Falta variable de entorno: ${name}`);
  }
  return process.env[name];
}

module.exports = {
  JWT_SECRET: required("JWT_SECRET"),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "8h"
};