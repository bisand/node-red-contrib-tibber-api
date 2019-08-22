/* eslint-env mocha */
let TibberFeed = require('../nodes/TibberFeed');
let assert = require('assert');
describe('TibberFeed', function() {
  describe('create', function() {
    it('Should be created', function() {
      assert.ok(new TibberFeed({}));
    });
    describe('inactive', function() {
      it('Should be inactive', function () {
        let feed = new TibberFeed({});
        assert.equal(feed.active, false);
      });
    });
  });
});
