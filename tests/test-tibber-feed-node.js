const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('assert');
const { createRED, createApiServer } = require('./helpers');
// ws is a dependency of tibber-api.
const WebSocket = require(require.resolve('ws', { paths: [require.resolve('tibber-api')] }));

const measurement = { timestamp: '2026-10-12T00:00:00.000+02:00', power: 1337, powerReactive: 12, powerProductionReactive: 34, currentL1: 5 };

function waitFor(condition, timeout = 8000) {
    return new Promise((resolve, reject) => {
        const started = Date.now();
        const timer = setInterval(() => {
            if (condition()) {
                clearInterval(timer);
                resolve();
            } else if (Date.now() - started > timeout) {
                clearInterval(timer);
                reject(new Error('Timed out waiting for condition'));
            }
        }, 20);
    });
}

describe('tibber-feed node', function () {
    let api;
    let wss;
    let RED;
    let nodes;
    let connections;
    let subscriptions;
    let rejectToken;

    before(async function () {
        api = await createApiServer();
        wss = new WebSocket.Server({ port: 0 });
        await new Promise((resolve) => wss.on('listening', resolve));
        wss.on('connection', (socket) => {
            connections++;
            socket.on('message', (data) => {
                const msg = JSON.parse(data);
                if (msg.type === 'connection_init') {
                    if (msg.payload.token === rejectToken) {
                        socket.close(4403, 'Invalid token');
                    } else {
                        socket.send(JSON.stringify({ type: 'connection_ack' }));
                    }
                } else if (msg.type === 'subscribe') {
                    subscriptions.push(msg.payload);
                    socket.send(JSON.stringify({ id: msg.id, type: 'next', payload: { data: { liveMeasurement: measurement } } }));
                }
            });
        });
    });

    after(async function () {
        for (const client of wss.clients) {
            client.terminate();
        }
        await new Promise((resolve) => wss.close(resolve));
        await api.close();
    });

    beforeEach(function () {
        RED = createRED();
        nodes = [];
        connections = 0;
        subscriptions = [];
        rejectToken = undefined;
        api.requests.length = 0;
        api.reply = (body) =>
            body.query.includes('websocketSubscriptionUrl')
                ? { status: 200, body: { data: { viewer: { websocketSubscriptionUrl: `ws://127.0.0.1:${wss.address().port}` } } } }
                : { status: 200, body: { data: { viewer: { home: { features: { realTimeConsumptionEnabled: true } } } } } };
    });

    afterEach(async function () {
        for (const node of nodes) {
            await RED.close(node);
        }
    });

    function createFeedNode(config, accessToken = 'feed-token') {
        const node = RED.create('tibber-feed', { active: true, homeId: 'home1', apiEndpointRef: RED.createEndpoint(api.url, accessToken), ...config });
        nodes.push(node);
        return node;
    }

    it('Should send the selected measurements', { timeout: 15000 }, async function () {
        const node = createFeedNode({ power: '1', powerReactive: true, powerProductionReactive: true, currentL1: false });

        await waitFor(() => node.sent.length > 0);

        assert.deepEqual(node.sent[0], { payload: { power: 1337, powerReactive: 12, powerProductionReactive: 34 } });
        assert.deepEqual(node.statuses.at(-1), { fill: 'green', shape: 'dot', text: 'connected' });
        assert.match(subscriptions[0].query, /powerReactive powerProductionReactive/);
        assert.deepEqual(subscriptions[0].variables, { homeId: 'home1' });
    });

    it('Should not write the access token to the log', { timeout: 15000 }, async function () {
        const first = createFeedNode({ power: '1' }, 'very-secret-token');
        const second = RED.create('tibber-feed', { active: true, homeId: 'home1', power: '1', apiEndpointRef: first._config.apiEndpointRef });
        nodes.push(second);

        await waitFor(() => first.sent.length > 0 && second.sent.length > 0);

        for (const node of [first, second]) {
            assert.ok(node.logs.length > 0);
            assert.ok(!node.logs.concat(node.errors).some((line) => String(line).includes('very-secret-token')));
        }
    });

    it('Should share one connection between nodes with the same token and home', { timeout: 15000 }, async function () {
        const first = createFeedNode({ power: '1' });
        const second = RED.create('tibber-feed', { active: true, homeId: 'home1', timestamp: '1', apiEndpointRef: first._config.apiEndpointRef });
        nodes.push(second);

        await waitFor(() => first.sent.length > 0 && second.sent.length > 0);

        assert.equal(connections, 1);
        assert.deepEqual(first.sent[0].payload, { power: 1337 });
        assert.deepEqual(second.sent[0].payload, { timestamp: measurement.timestamp });
    });

    it('Should close the connection and not reconnect when the node is closed', { timeout: 15000 }, async function () {
        const node = createFeedNode({ power: '1' });
        await waitFor(() => node.sent.length > 0);

        await RED.close(node);
        nodes.length = 0;
        await waitFor(() => wss.clients.size === 0);
        await new Promise((resolve) => setTimeout(resolve, 2500));

        assert.equal(connections, 1);
        assert.equal(wss.clients.size, 0);
        assert.deepEqual(node.statuses.at(-1), { fill: 'red', shape: 'ring', text: 'disconnected' });
        assert.deepEqual(RED.types['tibber-feed'].constructor.instances, {});
    });

    it('Should stop and show the status when the token is rejected', { timeout: 15000 }, async function () {
        rejectToken = 'bad-token';
        const node = createFeedNode({ power: '1' }, 'bad-token');

        await waitFor(() => node.errors.length > 0);
        await new Promise((resolve) => setTimeout(resolve, 3000));

        assert.equal(connections, 1);
        assert.match(node.errors[0], /Unauthenticated/);
        assert.deepEqual(node.statuses.at(-1), { fill: 'red', shape: 'dot', text: 'invalid token' });
    });

    it('Should connect with a token injected through a message', { timeout: 15000 }, async function () {
        rejectToken = 'bad-token';
        const node = createFeedNode({ power: '1' }, 'bad-token');
        await waitFor(() => node.errors.length > 0);

        const error = await RED.input(node, { payload: { accessToken: 'good-token' } });
        await waitFor(() => node.sent.length > 0);

        assert.equal(error, undefined);
        assert.deepEqual(node.sent[0].payload, { power: 1337 });
        assert.deepEqual(node.statuses.at(-1), { fill: 'green', shape: 'dot', text: 'connected' });
        // The injected token is not stored on the shared endpoint node.
        assert.equal(RED.nodes.getNode(node._config.apiEndpointRef).apiKey, undefined);
        assert.equal(RED.nodes.getCredentials(node._config.apiEndpointRef).accessToken, 'bad-token');
    });

    it('Should wait for a token when none is configured', { timeout: 15000 }, async function () {
        const node = createFeedNode({ power: '1' }, '');
        assert.ok(node.logs.some((line) => line.includes('Missing mandatory parameters')));

        assert.match(await RED.input(node, { payload: {} }), /Nothing to do/);
        assert.equal(await RED.input(node, { payload: { accessToken: 'good-token' } }), undefined);
        await waitFor(() => node.sent.length > 0);

        assert.equal(connections, 1);
    });

    it('Should not connect when the node is inactive', { timeout: 15000 }, async function () {
        const node = createFeedNode({ active: false, power: '1' });

        await new Promise((resolve) => setTimeout(resolve, 1500));

        assert.equal(connections, 0);
        assert.equal(api.requests.length, 0);
        assert.deepEqual(node.sent, []);
    });
});
