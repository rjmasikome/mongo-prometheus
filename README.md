# mongo-prometheus

Connector from mongodb to prometheus client that is ready to be scraped.

## Pre-requisite and requirement
* `node` > 8
* Make sure `mongodb` is installed
* Enable [oplog](https://docs.mongodb.com/manual/tutorial/convert-standalone-to-replica-set/) to your mongo

## Installation and Usage

### Quickstart
* Install the module in your project directory
```
npm install mongo-prometheus
```
* Initialize the class with proper config and ETL function
```js
const {MongoPrometheus} = require("mongo-prometheus");

const config = {
  database: "test",
  collection: "requests",
  job: "mongo-prometheus",
  defaultMetrics: true
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
```
* Navigate to `http://localhost:1337/metrics`

Here are some more details explanation about the config.
* `database`: database of mongo to check oplog
* `collection`: collection of mongo to check oplog
* `job`: job as a label for prometheus scrape
* `endpoint`: Endpoint of the metrics for scraping. Default is `/metrics`
* `port`: Port of the metrics for scraping. Default is `3031`
* `defaultMetrics`: Generate the default performance metrics. Default is `false`