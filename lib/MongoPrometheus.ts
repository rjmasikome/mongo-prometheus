"use strict";

import * as MongoOplog from "mongo-oplog";
import * as Debug from "debug";
import * as express from "express";
import {MongoClient} from "mongodb";
import { Counter, Gauge, register, Histogram, Summary, Registry , collectDefaultMetrics } from "prom-client";

const debug = Debug("mongo-prometheus:connector");
const DEFAULT_LABELS: string[] = ["label", "job"];
const RECORD_TYPES: string[] = ["counter", "gauge", "histogram", "summary"];
const DEFAULT_METRIC_KEYS: string[] = ["metric", "label", "value", "help", "type"];
const REGISTER: Registry = register;

interface Config {
  metrics: string;
  register: Registry;
  uri: string;
  oplogUri: string;
  port: number;
  collection: string;
  job: string;
  defaultMetrics: boolean;
  database: string;
}

export class MongoPrometheus {

  private config: Config | any;
  private isChanged: boolean;
  private endpoint: string;
  private metrics: Counter | Gauge | Histogram | Summary | {};
  private register: any;
  private etl: any;
  private mClient: MongoClient;

  constructor(config = {}, etl: void) {
    this.config = config;
    this.register = this.config.register || REGISTER;
    this.metrics = {};
    this.etl = etl;
    this._start();
  }

  _start() {

    if (!this.config.collection) {
      throw Error("No collection specified, exiting...");
    }

    const oplog = MongoOplog(this.config.oplogUri || "mongodb://127.0.0.1:27017/local", { ns: `${this.config.database}.${this.config.collection}` });
    this.mClient = MongoClient.connect(this.config.uri || `mongodb://127.0.0.1:27017/${this.config.database}`);

    if (this.config.defaultMetrics) {
      collectDefaultMetrics({register: this.register});
    }

    const server = express();

    server.get(this.config.endpoint || "/metrics", (req, res) => {
      res.set("Content-Type", this.register.contentType);
      res.end(this.register.metrics());
    });
    server.listen(this.config.port || 3031);

    oplog.tail();

    oplog.on("insert", doc => {
      this._process(doc);
    });

    oplog.on("update", doc => {
      this._process(doc);
    });

    oplog.on("error", doc => {
      process.exit();
    });
  }

  _process(doc): Promise<any> {

    // Enrich the data
    if (!this.mClient) {
      throw Error("MongoClient is not connected to Mongo Server");
    }

    if (!(doc.o2 || doc.o)) {
      throw new Error("No Data derived from oplog");
    }

    const _id: any = doc.o._id ? doc.o._id : (doc.o2._id ? doc.o2._id : null);

    debug(_id);

    return this.mClient
      .then((db: any) => {

        return db
          .collection(this.config.collection)
          .findOne({_id})
          .then((data: any) => {
            // Run the etl
            this.etl(data, (err, res) => {
              if (err) {
                throw err;
              }
              this._modify(res);
            });
          })
          .catch((err: Error) => {
            return Promise.reject(err);
          });
      })
      .catch((err: Error) => {
        throw err;
      });

  }

  _modify(data): void {
    // Set this flag to true, to initiate cleaning if there's change
    this.isChanged = true;

    debug(data);

    // Skip if it's empty
    if (!data) {
      return;
    }

    let metricObject: any;

    // Validate schema
    try {
      this._validate(data);
      metricObject = this._getMetricObject(data);
    } catch (err) {
      throw err;
    }

    const allLabels = this._getLabels(data);
    debug(allLabels);

    try {
      switch (data.type) {

      case "counter":
        metricObject.inc(allLabels, data.value);
        break;

      case "gauge":
        metricObject.set(allLabels, data.value);
        break;

      case "histogram":
        metricObject.observe(allLabels, data.value);
        break;

      case "summary":
        metricObject.observe(allLabels, data.value);
        break;

      default:
        // empty
      }

    }
    catch (err) {
      throw err;
    }
  }

  _getLabels(data) {

    // Case of data.label is string
    // e.g: {label: "foo"}
    const singleLabel = data.label && typeof data.label === "string" ? {label: data.label} : null;

    // Case of data.label is object
    // e.g: {label: {foo: "bar"}}
    let multiLabel = data.label && typeof data.label === "object" ? data.label : null;

    // Case of additional label is not children of key label
    // e.g: {label: "test", "foo": "bar"}
    if (!multiLabel) {
      multiLabel = {};
      for (const key in data) {
        if (DEFAULT_METRIC_KEYS.indexOf(key) === -1) {
          multiLabel[key] = data[key];
        }
      }
    }

    return Object.assign({}, {
      job: this.config.job
    },
    singleLabel,
    multiLabel
    );
  }

  _validate(data): void {

    const {metric, value, type, help} = data;

    if (!metric || !value) {
      throw new Error("no metric and/or value");
    }

    if (typeof metric !== "string") {
      throw new Error("A metric should be string.");
    }

    if (typeof value !== "number") {
      throw new Error("A value of metric should be number.");
    }

    if (help && typeof help !== "string") {
      throw new Error("A help of metric should be string.");
    }

    if (type && typeof type !== "string") {
      throw new Error("A type of metric should be string.");
    }
  }

  _getMetricObject(data: any) {
    return this.metrics[data.metric] || this._newObject(data);
  }

  _newObject(record) {

    let object;
    const addLabels = this.config.additionalLabels || [];
    record.help = record.help || `${record.metric} with type ${record.type || "gauge"}`;

    switch (record.type) {

    case "counter":
      object = new Counter({
        name: record.metric,
        help: record.help,
        registers: [this.register],
        labelNames: DEFAULT_LABELS.concat(addLabels)
      });
      break;

    case "gauge":
      object = new Gauge({
        name: record.metric,
        help: record.help,
        registers: [this.register],
        labelNames: DEFAULT_LABELS.concat(addLabels)
      });
      break;

    case "histogram":
      object = new Histogram({
        name: record.metric,
        help: record.help,
        registers: [this.register],
        labelNames: DEFAULT_LABELS.concat(addLabels)
      });
      break;

    case "summary":
      object = new Summary({
        name: record.metric,
        help: record.help,
        registers: [this.register],
        labelNames: DEFAULT_LABELS.concat(addLabels)
      });
      break;

    default:
      throw new Error(`The record type ${record.type} is not supported. Please use one of the following: ${RECORD_TYPES.join(", ")}.`);
    }

    this.metrics[record.metric] = object;
    return this.metrics[record.metric];
  }
}
