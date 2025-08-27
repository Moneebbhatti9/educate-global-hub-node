const express = require("express");

const morgan = require("morgan");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const { errorHandler } = require("./errorHandler");
const { notFoundHandler } = require("./notFoundHandler");
const YAML = require("yamljs");
const swaggerDocument = YAML.load("src/docs/swagger.yaml");

module.exports.applyMiddlewares = (app) => {
  app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }));
  app.disable("x-powered-by");

  app.use(express.static("public"));

  if (process.env.NODE_ENV !== "production") {
    app.use(
      "/api-docs",
      swaggerUi.serve,
      swaggerUi.setup(swaggerDocument, {
        customCss: ".swagger-ui .topbar { display: none }",
        customSiteTitle: `Educate-Global Docs`,
      })
    );
  }

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.use(
    morgan(":method :url :status :res[content-length] - :response-time ms")
  );
};

module.exports.applyErrorMiddlewares = (app) => {
  app.use(notFoundHandler);
  app.use(errorHandler);
};
