"use strict";

import {MongoPrometheus} from "../lib/MongoPrometheus";

const config = {
  database: "any",
  collection: "requests"
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

const client = new MongoPrometheus(config, etl);
