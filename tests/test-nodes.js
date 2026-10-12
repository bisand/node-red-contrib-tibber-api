const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('assert');
const { createRED, createApiServer } = require('./helpers');
const { version } = require('../package.json');

describe('Nodes', function () {
    let api;
    let RED;

    before(async function () {
        api = await createApiServer();
    });

    after(async function () {
        await api.close();
    });

    beforeEach(function () {
        RED = createRED();
        api.requests.length = 0;
        api.reply = () => ({ status: 200, body: { data: {} } });
    });

    describe('tibber-api-endpoint', function () {
        it('Should use the package version in the user agent', function () {
            const endpoint = RED.nodes.getNode(RED.createEndpoint(api.url));
            assert.equal(endpoint.userAgent, `bisand/node-red-contrib-tibber-api/${version}`);
        });

        it('Should store the access token as a password', function () {
            assert.equal(RED.types['tibber-api-endpoint'].options.credentials.accessToken.type, 'password');
        });

        it('Should move a legacy api key to the credentials', function () {
            const endpoint = RED.create('tibber-api-endpoint', { queryUrl: api.url, apiKey: 'legacy' });
            assert.equal(RED.nodes.getCredentials(endpoint.id).accessToken, 'legacy');
            assert.equal(endpoint.apiKey, undefined);
        });
    });

    describe('tibber-query', function () {
        it('Should return the result of a query', async function () {
            api.reply = () => ({ status: 200, body: { data: { viewer: { name: 'Arya' } } } });
            const node = RED.create('tibber-query', { apiEndpointRef: RED.createEndpoint(api.url, 'secret') });

            const error = await RED.input(node, { payload: '{viewer{name}}', topic: 'keep' });

            assert.equal(error, undefined);
            assert.deepEqual(node.sent, [{ payload: { viewer: { name: 'Arya' } }, topic: 'keep' }]);
            assert.equal(api.requests[0].body.query, '{viewer{name}}');
            assert.equal(api.requests[0].headers.authorization, 'Bearer secret');
            assert.match(api.requests[0].headers['user-agent'], new RegExp(`^bisand/node-red-contrib-tibber-api/${version} bisand/tibber-api/`));
        });

        it('Should report an error when the token is invalid', async function () {
            api.reply = () => ({ status: 200, body: { errors: [{ message: 'invalid token', extensions: { code: 'UNAUTHENTICATED' } }], data: null } });
            const node = RED.create('tibber-query', { apiEndpointRef: RED.createEndpoint(api.url) });

            const error = await RED.input(node, { payload: '{viewer{name}}' });

            assert.ok(error instanceof Error);
            assert.equal(error.message, 'invalid token');
            assert.deepEqual(node.sent, []);
        });

        it('Should report an error when the server fails', async function () {
            api.reply = () => ({ status: 502, body: 'Bad Gateway' });
            const node = RED.create('tibber-query', { apiEndpointRef: RED.createEndpoint(api.url) });

            const error = await RED.input(node, { payload: '{viewer{name}}' });

            assert.equal(error.message, 'Bad Gateway');
            assert.equal(error.statusCode, 502);
        });

        it('Should report an error when the payload is not a query', async function () {
            const node = RED.create('tibber-query', { apiEndpointRef: RED.createEndpoint(api.url) });

            const error = await RED.input(node, { payload: { query: 'x' } });

            assert.match(error.message, /Missing mandatory parameter/);
            assert.equal(api.requests.length, 0);
        });

        for (const type of ['tibber-query', 'tibber-data', 'tibber-notify', 'tibber-update-home', 'tibber-feed']) {
            it(`Should not throw when ${type} has no API endpoint`, function () {
                const node = RED.create(type, { active: true, homeId: 'home1' });
                assert.equal(node.errors.length + node.logs.filter((l) => l.includes('Missing mandatory parameters')).length, 1);
            });
        }

        it('Should not use an endpoint without an access token', function () {
            const node = RED.create('tibber-query', { apiEndpointRef: RED.createEndpoint(api.url, '') });
            assert.match(node.errors[0], /Missing mandatory parameters/);
        });

        it('Should not share the access token through the endpoint node', function () {
            const endpointId = RED.createEndpoint(api.url, 'secret');
            RED.create('tibber-query', { apiEndpointRef: endpointId });
            assert.equal(RED.nodes.getNode(endpointId).apiKey, undefined);
        });
    });

    describe('tibber-data', function () {
        it('Should run the query from the payload', async function () {
            api.reply = () => ({ status: 200, body: { data: { viewer: { homes: [{ id: 'home1' }] } } } });
            const node = RED.create('tibber-data', { apiEndpointRef: RED.createEndpoint(api.url) });

            const error = await RED.input(node, { payload: { queryName: 'getHomes' } });

            assert.equal(error, undefined);
            assert.deepEqual(node.sent[0].payload, [{ id: 'home1' }]);
        });

        it('Should prefer the values configured on the node', async function () {
            api.reply = () => ({ status: 200, body: { data: { viewer: { home: { consumption: { nodes: [{ from: 'a' }] } } } } } });
            const node = RED.create('tibber-data', {
                apiEndpointRef: RED.createEndpoint(api.url),
                queryName: 'getConsumption',
                homeId: 'home1',
                energyResolution: 'DAILY',
                lastCount: 7,
            });

            await RED.input(node, { payload: { queryName: 'getHomes', homeId: 'other', energyResolution: 'HOURLY', lastCount: 1 } });

            assert.deepEqual(node.sent[0].payload, [{ from: 'a' }]);
            assert.deepEqual(api.requests[0].body.variables, { homeId: 'home1', resolution: 'DAILY', lastCount: 7 });
        });

        it('Should use hourly prices unless quarter-hourly is requested', async function () {
            api.reply = () => ({ status: 200, body: { data: { viewer: { home: { currentSubscription: { priceInfo: { today: [{ total: 1 }] } } } } } } });
            const node = RED.create('tibber-data', { apiEndpointRef: RED.createEndpoint(api.url), queryName: 'getTodaysEnergyPrices', homeId: 'home1' });

            await RED.input(node, { payload: { energyResolution: 'DAILY' } });
            await RED.input(node, { payload: { energyResolution: 'QUARTER_HOURLY' } });

            assert.equal(api.requests[0].body.variables.resolution, 'HOURLY');
            assert.equal(api.requests[1].body.variables.resolution, 'QUARTER_HOURLY');
        });

        it('Should return a price range and convert dates to cursors', async function () {
            const priceInfoRange = { pageInfo: { count: 1 }, nodes: [{ total: 1 }] };
            api.reply = () => ({ status: 200, body: { data: { viewer: { home: { currentSubscription: { priceInfoRange } } } } } });
            const node = RED.create('tibber-data', { apiEndpointRef: RED.createEndpoint(api.url) });

            await RED.input(node, {
                payload: { queryName: 'getEnergyPriceRange', homeId: 'home1', energyResolution: 'QUARTER_HOURLY', first: 96, after: '2026-10-10T00:00:00.000Z' },
            });

            assert.deepEqual(node.sent[0].payload, priceInfoRange);
            assert.deepEqual(api.requests[0].body.variables, {
                homeId: 'home1',
                resolution: 'QUARTER_HOURLY',
                first: 96,
                after: Buffer.from('2026-10-10T00:00:00.000Z').toString('base64'),
            });
        });

        it('Should page with lastCount by default and pass cursors through', async function () {
            const production = { pageInfo: { count: 1 }, nodes: [{ production: 1 }] };
            api.reply = () => ({ status: 200, body: { data: { viewer: { home: { production } } } } });
            const node = RED.create('tibber-data', { apiEndpointRef: RED.createEndpoint(api.url), lastCount: 5 });

            await RED.input(node, { payload: { queryName: 'getProductionPage', homeId: 'home1', before: 'Y3Vyc29y', filterEmptyNodes: true } });

            assert.deepEqual(node.sent[0].payload, production);
            assert.deepEqual(api.requests[0].body.variables, { homeId: 'home1', resolution: 'HOURLY', last: 5, before: 'Y3Vyc29y', filterEmptyNodes: true });
        });

        it('Should return production for all homes', async function () {
            api.reply = () => ({ status: 200, body: { data: { viewer: { homes: [{ id: 'home1', production: { nodes: [{ production: 1 }] } }] } } } });
            const node = RED.create('tibber-data', { apiEndpointRef: RED.createEndpoint(api.url) });

            await RED.input(node, { payload: { queryName: 'getProduction' } });

            assert.deepEqual(node.sent[0].payload, [{ production: 1, homeId: 'home1' }]);
            assert.equal(api.requests[0].body.variables.lastCount, 10);
        });

        it('Should report an error for an unknown query', async function () {
            const node = RED.create('tibber-data', { apiEndpointRef: RED.createEndpoint(api.url) });

            const error = await RED.input(node, { payload: { queryName: 'constructor' } });

            assert.equal(error.message, 'Unknown query: constructor');
            assert.deepEqual(node.sent, []);
        });

        it('Should not throw when the payload is not an object', async function () {
            const node = RED.create('tibber-data', { apiEndpointRef: RED.createEndpoint(api.url) });

            assert.equal((await RED.input(node, {})).message, 'Unknown query: undefined');
            assert.equal((await RED.input(node, { payload: 'getHomes' })).message, 'Unknown query: undefined');
        });

        it('Should report an error when the query fails', async function () {
            api.reply = () => ({ status: 200, body: { errors: [{ message: 'invalid token' }], data: null } });
            const node = RED.create('tibber-data', { apiEndpointRef: RED.createEndpoint(api.url), queryName: 'getHomes' });

            const error = await RED.input(node, { payload: {} });

            assert.equal(error.message, 'invalid token');
            assert.deepEqual(node.sent, []);
        });
    });

    describe('tibber-notify', function () {
        it('Should send the notification as variables', async function () {
            api.reply = () => ({ status: 200, body: { data: { sendPushNotification: { successful: true, pushedToNumberOfDevices: 1 } } } });
            const node = RED.create('tibber-notify', { apiEndpointRef: RED.createEndpoint(api.url) });
            const title = 'Price "alert"';
            const message = 'First line\n}){successful}}';

            const error = await RED.input(node, { payload: { title, message } });

            assert.equal(error, undefined);
            assert.deepEqual(api.requests[0].body.variables, { input: { title, message, screenToOpen: 'HOME' } });
            assert.ok(!api.requests[0].body.query.includes('alert'));
        });

        it('Should prefer the values configured on the node', async function () {
            api.reply = () => ({ status: 200, body: { data: { sendPushNotification: { successful: true, pushedToNumberOfDevices: 1 } } } });
            const node = RED.create('tibber-notify', {
                apiEndpointRef: RED.createEndpoint(api.url),
                notifyTitle: 'Title',
                notifyMessage: 'Message',
                notifyScreen: 'CONSUMPTION',
            });

            await RED.input(node, { payload: 'ignored' });

            assert.deepEqual(api.requests[0].body.variables, { input: { title: 'Title', message: 'Message', screenToOpen: 'CONSUMPTION' } });
        });

        it('Should report an error when title or message is missing', async function () {
            const node = RED.create('tibber-notify', { apiEndpointRef: RED.createEndpoint(api.url) });

            const error = await RED.input(node, { payload: { title: 'Title' } });

            assert.match(error.message, /Missing mandatory parameters/);
            assert.equal(api.requests.length, 0);
        });

        it('Should report an error when the notification is rejected', async function () {
            api.reply = () => ({ status: 200, body: { errors: [{ message: 'operation not allowed for demo user' }], data: null } });
            const node = RED.create('tibber-notify', { apiEndpointRef: RED.createEndpoint(api.url) });

            const error = await RED.input(node, { payload: { title: 'Title', message: 'Message' } });

            assert.equal(error.message, 'operation not allowed for demo user');
        });
    });

    describe('tibber-update-home', function () {
        it('Should update the home and return it', async function () {
            api.reply = () => ({ status: 200, body: { data: { updateHome: { id: 'home1', appNickname: 'Cabin' } } } });
            const node = RED.create('tibber-update-home', { apiEndpointRef: RED.createEndpoint(api.url) });

            const error = await RED.input(node, { payload: { homeId: 'home1', appNickname: 'Cabin', unknown: 'ignored' } });

            assert.equal(error, undefined);
            assert.deepEqual(node.sent[0].payload, { id: 'home1', appNickname: 'Cabin' });
            assert.deepEqual(api.requests[0].body.variables, { input: { homeId: 'home1', appNickname: 'Cabin' } });
        });

        it('Should report an error when homeId is missing', async function () {
            const node = RED.create('tibber-update-home', { apiEndpointRef: RED.createEndpoint(api.url) });

            const error = await RED.input(node, { payload: 'text' });

            assert.match(error.message, /Missing mandatory parameter/);
        });

        it('Should report an error when the update fails', async function () {
            api.reply = () => ({ status: 200, body: { errors: [{ message: 'not allowed' }], data: null } });
            const node = RED.create('tibber-update-home', { apiEndpointRef: RED.createEndpoint(api.url), homeId: 'home1' });

            const error = await RED.input(node, { payload: {} });

            assert.equal(error.message, 'not allowed');
            assert.deepEqual(node.sent, []);
        });
    });
});
