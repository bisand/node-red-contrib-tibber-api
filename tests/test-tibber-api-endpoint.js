/* eslint-env mocha */
let UrlTools = require('tibber-api').UrlTools;
let assert = require('assert');
const urlTools = new UrlTools();

describe('tibber-api-endpoint', function () {
  describe('Validate Url', function () {
    it('Websocket url should be valid', function () {
      let isValid = urlTools.validateUrl("wss://api.tibber.com/v1-beta/gql/subscriptions");
      assert.ok(isValid);
    });
    it('Query url should be valid', function () {
      let isValid = urlTools.validateUrl("https://api.tibber.com/v1-beta/gql");
      assert.ok(isValid);
    });
    it('Websocket url should be invalid', function () {
      let isValid = urlTools.validateUrl("wss//api.tibber.com/v1-beta/gql/subscriptions");
      assert.ok(!isValid);
    });
    it('Query url should be invalid', function () {
      let isValid = urlTools.validateUrl("https//api.tibber.com/v1-beta/gql");
      assert.ok(!isValid);
    });
  });
});
