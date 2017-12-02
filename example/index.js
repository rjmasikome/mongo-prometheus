"use strict";

const {MongoPrometheus} = require("../build/MongoPrometheus");
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
  }
  next(null, record);
}

new MongoPrometheus(config, etl);