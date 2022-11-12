/* eslint-env mocha */
const { TibberQueryBase, TibberFeed } = require('tibber-api');
const assert = require('assert');
const WebSocket = require('ws');

class FakeTibberQuery extends TibberQueryBase {
    /**
     * Constructor
     * Create an instace of TibberQuery class
     * @param config IConfig object
     * @see IConfig
     */
    constructor(config) {
        super(config);
    }

    async getWebsocketSubscriptionUrl() {
        return new URL(this.config.endpoint.url);
    }

}


describe('TibberFeed', function () {
    let server = undefined;

    before(function () {
        server = new WebSocket.Server({ port: 1337 });
        server.on('connection', function (socket) {
            socket.on('message', function (msg) {
                let obj = JSON.parse(msg);
                if (obj.type == 'connection_init' && obj.payload.token === '1337') {
                    obj.type = 'connection_ack';
                    socket.send(JSON.stringify(obj));
                } else if (obj.type == 'subscribe'
                    && obj.payload.query
                    && obj.payload.query.startsWith('subscription($homeId:ID!){liveMeasurement(homeId:$homeId){')
                    && obj.payload.variables
                    && obj.payload.variables.homeId === '1337') {
                    obj = {
                        id: obj.id,
                        type: 'next',
                        payload: { data: { liveMeasurement: { value: 1337 } } },
                    };
                    socket.send(JSON.stringify(obj));
                } else if (obj.type == 'subscribe'
                    && obj.payload.query
                    && obj.payload.query.startsWith('subscription($homeId:ID!){liveMeasurement(homeId:$homeId){')
                    && obj.payload.variables
                    && obj.payload.variables.homeId === '42') {
                    obj = {
                        id: obj.id,
                        type: 'next',
                        payload: { data: { liveMeasurement: { value: 42 } } },
                    };
                    socket.send(JSON.stringify(obj));
                }
            });
            socket.on('close', function () { });
        });
    });

    after(function () {
        if (server) {
            server.close();
            server = null;
        }
    });

    describe('create', function () {
        it('Should be created', function () {
            const query = new FakeTibberQuery({
                endpoint: {
                    url: 'ws://localhost:1337',
                    apiKey: '1337',
                },
                homeId: '1337',
                active: true,
            });
            let feed = new TibberFeed(query);
            assert.ok(feed);
        });
    });

    describe('connect', function () {
        it('Should be connected', function (done) {
            const query = new FakeTibberQuery({
                endpoint: {
                    url: 'ws://localhost:1337',
                    apiKey: '1337',
                },
                homeId: '1337',
                active: true,
            });
            const feed = new TibberFeed(query);
            feed.on('connection_ack', function (data) {
                assert.ok(data);
                assert.equal(data.payload.token, '1337');
                feed.close();
                done();
            });
            feed.connect();
        });
    });

    describe('receive', function () {
        it('Should receive data', function (done) {
            const query = new FakeTibberQuery({
                endpoint: {
                    url: 'ws://localhost:1337',
                    apiKey: '1337',
                },
                homeId: '1337',
                active: true,
            });
            const feed = new TibberFeed(query);
            feed.on('data', function (data) {
                assert.ok(data);
                assert.equal(data.value, 1337);
                feed.close();
                done();
            });
            feed.connect();
        });
    });

    describe('receive', function () {
        it('Should receive data from two homes', function (done) {
            this.timeout(5000);
            let done1, done2 = false;
            const query1 = new FakeTibberQuery({
                endpoint: {
                    url: 'ws://localhost:1337',
                    apiKey: '1337',
                },
                homeId: '1337',
                active: true,
            });
            const feed1 = new TibberFeed(query1);
            const query2 = new FakeTibberQuery({
                endpoint: {
                    url: 'ws://localhost:1337',
                    apiKey: '1337',
                },
                homeId: '42',
                active: true,
            });
            const feed2 = new TibberFeed(query2);
            feed1.on('data', function (data) {
                assert.ok(data);
                assert.equal(data.value, 1337);
                feed1.close();
                done1 = true;
            });
            feed2.on('data', function (data) {
                assert.ok(data);
                assert.equal(data.value, 42);
                feed2.close();
                done2 = true;
            });
            feed2.connect();
            feed1.connect();
            let interval = setInterval(() => {
                if (done1 && done2) {
                    clearInterval(interval);
                    done();
                }
            }, 100);
        });
    });

    describe('active', function () {
        it('Should be active', function () {
            const query = new FakeTibberQuery({
                endpoint: {
                    url: 'ws://localhost:1337',
                    apiKey: '1337',
                },
                homeId: '1337',
                active: true,
            });
            const feed = new TibberFeed(query);
            assert.equal(feed.active, true);
        });
    });

    describe('inactive', function () {
        it('Should be inactive', function () {
            const query = new FakeTibberQuery({
                endpoint: {
                    url: 'ws://localhost:1337',
                    apiKey: '1337',
                },
                homeId: '1337',
                active: false,
            });
            let feed = new TibberFeed(query);
            assert.equal(feed.active, false);
        });
    });

    describe('timeout', function () {
        it('Should timeout after 3 sec', function (done) {
            this.timeout(10000);
            const query = new FakeTibberQuery(
                {
                    endpoint: {
                        url: 'ws://localhost:1337',
                        apiKey: '1337',
                    },
                    homeId: '1337',
                    active: true,
                },
            );
            let called = false;
            const feed = new TibberFeed(query, 3000);
            feed.on('connection_ack', function (data) {
                assert.ok(data);
                feed.heartbeat();
            });
            feed.on('disconnected', function (data) {
                assert.ok(data);
                if (!called) {
                    called = true;
                    feed.active = false;
                    feed.close();
                    done();
                }
            });
            feed.connect();
        });
    });

    describe('reconnect', function () {
        it('Should reconnect 5 times after 1 sec. timeout', function (done) {
            this.timeout(10000);
            const query = new FakeTibberQuery(
                {
                    endpoint: {
                        url: 'ws://localhost:1337',
                        apiKey: '1337',
                    },
                    homeId: '1337',
                    active: true,
                },
            );
            let callCount = 0;
            const feed = new TibberFeed(query, 1000);
            feed.on('connection_ack', function (data) {
                assert.ok(data);
                assert.equal(data.payload.token, '1337');
                feed.heartbeat();
            });
            feed.on('disconnected', function (data) {
                assert.ok(data);
                if (callCount == 4) {
                    feed.active = false;
                    feed.close();
                    done();
                }
                callCount++;
            });
            feed.connect();
        });
    });
});
