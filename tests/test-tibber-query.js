/* eslint-env mocha */
let TibberQuery = require('../nodes/TibberQuery');
let assert = require('assert');
describe('TibberQuery', function() {
  describe('create', function() {
    it('Should be created', function() {
      assert.ok(new TibberQuery({}));
    });
    describe('inactive', function() {
      it('Should be inactive', function () {
        let feed = new TibberQuery({});
        assert.equal(feed.active, false);
      });
    });
  });
});
