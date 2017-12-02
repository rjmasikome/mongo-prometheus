"use strict";

const {MongoPrometheus} = require("../lib/MongoPrometheus");
const config = {
  database: "homelike",
  collection: "requests",
  job: "mongo-prometheus"
};

const etl = (data, next) => {
  const record = {
    metric: "test_metric",
    value: data.total,
    type: "counter",
    label: "test"
  };

  next(null, record);
};

const start = new MongoPrometheus(config, etl);