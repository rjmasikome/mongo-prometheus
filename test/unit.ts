import { MongoPrometheus } from "../lib/MongoPrometheus";
import * as assert from "assert";

describe("client Unit", () => {

  const client = new MongoPrometheus({
      database: "test",
      collection: "any"
    }, (data, next) => {next(null, {});
  });

  describe("Correct value", () => {

    it("should register the metric", (done) => {

      const expected = client._newObject({metric: "test_metric", type: "gauge"});

      assert.doesNotThrow(() => {
        const metric = client._getMetricObject({metric: "test_metric", type: "gauge"});
        assert.deepEqual(metric, expected);
        done();
      });
    });

    it("set on gauge should change the value", (done) => {
      const expected = 123;
      assert.doesNotThrow(() => {
        const metric = client._getMetricObject({metric: "gauge_metric", type: "gauge"});
        client._modify({metric: "gauge_metric", type: "gauge", label: "test", value: 456});
        client._modify({metric: "gauge_metric", type: "gauge", label: "test", value: 123});
        assert.deepEqual(metric.hashMap["job:mongo_prometheus,label:test"].value, expected);
        done();
      });
    });

    it("inc on counter should increase the value", (done) => {
      const expected = 3;
      assert.doesNotThrow(() => {
        const metric = client._getMetricObject({metric: "counter_metric", type: "gauge"});
        client._modify({metric: "counter_metric", type: "counter", label: "test", value: 1});
        client._modify({metric: "counter_metric", type: "counter", label: "test", value: 2});
        assert.deepEqual(metric.hashMap["job:mongo_prometheus,label:test"].value, expected);
        done();
      });
    });

    it("observe on histogram should return correct count and sum", (done) => {
      const expectedSum = 3;
      const expectedCount = 2;
      assert.doesNotThrow(() => {
        const metric = client._getMetricObject({metric: "histogram_metric", type: "histogram"});
        client._modify({metric: "histogram_metric", type: "histogram", label: "test", value: 1});
        client._modify({metric: "histogram_metric", type: "histogram", label: "test", value: 2});
        assert.deepEqual(metric.hashMap["job:mongo_prometheus,label:test"].sum, expectedSum);
        assert.deepEqual(metric.hashMap["job:mongo_prometheus,label:test"].count, expectedCount);
        done();
      });
    });

    it("observe on summary should return correct count and sum", (done) => {
      const expectedSum = 3;
      const expectedCount = 2;
      assert.doesNotThrow(() => {
        const metric = client._getMetricObject({metric: "summary_metric", type: "histogram"});
        client._modify({metric: "summary_metric", type: "summary", label: "test", value: 1});
        client._modify({metric: "summary_metric", type: "summary", label: "test", value: 2});
        assert.deepEqual(metric.hashMap["job:mongo_prometheus,label:test"].sum, expectedSum);
        assert.deepEqual(metric.hashMap["job:mongo_prometheus,label:test"].count, expectedCount);
        done();
      });
    });

    it("should create the correct label for custom label - nested", (done) => {
      const expected = {job: "mongo_prometheus", label: "test", method: "get"};
      assert.doesNotThrow(() => {
        const labels = client._getLabels({metric: "test_label_1", type: "gauge", label: { label: "test", method: "get"}});
        assert.deepEqual(labels, expected);
        done();
      });
    });

    it("should create the correct label for custom label - not nested", (done) => {
      const expected = {job: "mongo_prometheus", label: "test", method: "get"};
      assert.doesNotThrow(() => {
        const labels = client._getLabels({metric: "test_label_1", type: "gauge", label: "test", method: "get"});
        assert.deepEqual(labels, expected);
        done();
      });
    });

  });

  describe("Errornous value", () => {

    it("should fail when object has been registered", (done) => {
      const expected = "no metric and/or value";
      try {
        client._validate({metric: "fail_1"});
      } catch (err) {
        const message = err.message;
        assert.deepEqual(message, expected);
        done();
      }
    });

    it("should fail on non string metric", (done) => {
      const expected = "A metric should be string.";
      try {
        client._validate({metric: 123, value: 456});
      } catch (err) {
        const message = err.message;
        assert.deepEqual(message, expected);
        done();
      }
    });

    it("should fail on non number value", (done) => {
      const expected = "A value of metric should be number.";
      try {
        client._validate({metric: "fail_2", value: "foo"});
      } catch (err) {
        const message = err.message;
        assert.deepEqual(message, expected);
        done();
      }
    });

    it("should fail on non string type", (done) => {
      const expected = "A type of metric should be string.";
      try {
        client._validate({metric: "fail_3", value: 1, type: 123});
      } catch (err) {
        const message = err.message;
        assert.deepEqual(message, expected);
        done();
      }
    });

    it("should fail on non string help", (done) => {
      const expected = "A help of metric should be string.";
      try {
        client._validate({metric: "fail_4", value: 1, help: 123});
      } catch (err) {
        const message = err.message;
        assert.deepEqual(message, expected);
        done();
      }
    });

  });

});
