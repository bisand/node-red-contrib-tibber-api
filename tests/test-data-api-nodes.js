const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createRED, createApiServer, createDataApiServer } = require('./helpers');
// ws is a dependency of tibber-api.
const WebSocket = require(require.resolve('ws', { paths: [require.resolve('tibber-api')] }));
const { loadTokens, saveTokens, deleteTokens, TOKEN_FILE } = require('../nodes/tibber-token-store');

const redirectUri = 'http://localhost:1880/tibber-api/callback';

function json(res, body, status = 200) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
}

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

describe('Data API nodes', function () {
    let api;
    let RED;
    let nodes;
    let endpoints;

    before(async function () {
        api = await createDataApiServer();
    });

    after(async function () {
        await api.close();
    });

    beforeEach(function () {
        RED = createRED(api.settings);
        nodes = [];
        endpoints = [];
        api.requests.length = 0;
        api.tokenRequests.length = 0;
        api.tokens = { access_token: 'access', refresh_token: 'refresh', expires_in: 3600 };
        api.reply = (req, res) => json(res, {});
    });

    afterEach(async function () {
        for (const node of nodes) {
            await RED.close(node);
        }
        // Closing the endpoints stops their token refresh timers.
        for (const id of endpoints) {
            await RED.close(RED.nodes.getNode(id));
        }
        fs.rmSync(RED.settings.userDir, { recursive: true, force: true });
    });

    /** Create an API endpoint node that logs in, logged in unless tokens is null. Returns its id. */
    function createEndpoint(tokens) {
        const id = RED.createLoginEndpoint(tokens);
        endpoints.push(id);
        return id;
    }

    function create(type, config) {
        const node = RED.create(type, config);
        nodes.push(node);
        return node;
    }

    describe('token store', function () {
        it('Should keep the tokens of each endpoint in a private file in the user directory', function () {
            saveTokens(RED, 'a', { accessToken: 'one' });
            saveTokens(RED, 'b', { accessToken: 'two' });

            const file = path.join(RED.settings.userDir, TOKEN_FILE);
            assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf-8')), { a: { accessToken: 'one' }, b: { accessToken: 'two' } });
            if (process.platform !== 'win32') {
                assert.equal(fs.statSync(file).mode & 0o777, 0o600);
            }
            assert.deepEqual(fs.readdirSync(RED.settings.userDir), [TOKEN_FILE]);

            deleteTokens(RED, 'a');
            assert.equal(loadTokens(RED, 'a'), undefined);
            assert.deepEqual(loadTokens(RED, 'b'), { accessToken: 'two' });
        });

        it('Should return nothing when the file is missing or damaged', function () {
            assert.equal(loadTokens(RED, 'a'), undefined);
            fs.writeFileSync(path.join(RED.settings.userDir, TOKEN_FILE), 'not json');
            assert.equal(loadTokens(RED, 'a'), undefined);
        });
    });

    describe('tibber-api-endpoint login', function () {
        it('Should store the client secret as a password', function () {
            assert.equal(RED.types['tibber-api-endpoint'].options.credentials.clientSecret.type, 'password');
        });

        it('Should have no client until the user has logged in', function () {
            assert.equal(RED.nodes.getNode(createEndpoint(null)).getDataClient(), undefined);
            assert.ok(RED.nodes.getNode(createEndpoint()).getDataClient());
        });

        it('Should require permission to start a login and read the status, but not for the callback', function () {
            assert.equal(RED.routes['POST /tibber-api/:id/auth'].permission, 'tibber-api-endpoint.write');
            assert.equal(RED.routes['GET /tibber-api/:id/status'].permission, 'tibber-api-endpoint.read');
            assert.equal(RED.routes['GET /tibber-api/callback'].permission, undefined);
        });

        it('Should log in and store the tokens', async function () {
            const id = 'new-endpoint';
            assert.deepEqual((await RED.request('GET /tibber-api/:id/status', { params: { id } })).body, { authorized: false });

            const started = await RED.request('POST /tibber-api/:id/auth', {
                params: { id },
                body: { clientId: 'client', clientSecret: 'secret', scopes: 'openid data-api-homes-read', redirectUri },
            });

            assert.equal(started.status, 200);
            const url = new URL(started.body.url);
            assert.equal(url.origin + url.pathname, 'https://thewall.tibber.com/connect/authorize');
            assert.equal(url.searchParams.get('client_id'), 'client');
            assert.equal(url.searchParams.get('redirect_uri'), redirectUri);
            assert.equal(url.searchParams.get('scope'), 'openid data-api-homes-read');
            assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
            assert.ok(!started.body.url.includes('secret'));

            const before = Date.now();
            const finished = await RED.request('GET /tibber-api/callback', { query: { code: 'the-code', state: url.searchParams.get('state') } });

            assert.equal(finished.status, 200);
            assert.match(finished.body, /Logged in to Tibber/);
            assert.equal(api.tokenRequests[0].code, 'the-code');
            assert.equal(api.tokenRequests[0].client_secret, 'secret');
            assert.equal(api.tokenRequests[0].redirect_uri, redirectUri);
            assert.ok(api.tokenRequests[0].code_verifier);
            const tokens = loadTokens(RED, id);
            assert.equal(tokens.accessToken, 'access');
            assert.equal(tokens.refreshToken, 'refresh');
            assert.ok(tokens.expiresAt >= before + 3600000);
            assert.deepEqual((await RED.request('GET /tibber-api/:id/status', { params: { id } })).body, { authorized: true });

            // The same state can not be used twice.
            assert.equal((await RED.request('GET /tibber-api/callback', { query: { code: 'the-code', state: url.searchParams.get('state') } })).status, 400);
        });

        it('Should keep the client that was used to log in, and return the browser to the editor', async function () {
            // The endpoint is deployed with another client. The user enters a new one and logs in without saving.
            const id = createEndpoint(null);
            const started = await RED.request('POST /tibber-api/:id/auth', {
                params: { id },
                body: { clientId: 'new-client', clientSecret: 'new-secret', redirectUri, returnUrl: 'http://localhost:1880/#flow/"tab<1>' },
            });
            const state = new URL(started.body.url).searchParams.get('state');

            const finished = await RED.request('GET /tibber-api/callback', { query: { code: 'the-code', state } });

            assert.deepEqual(RED.nodes.getCredentials(id), { clientId: 'new-client', clientSecret: 'new-secret' });
            // A later refresh uses the new client.
            RED.nodes.getNode(id).getDataClient().tokens.expiresAt = Date.now() - 1000;
            await RED.nodes.getNode(id).getAccessToken();
            assert.equal(api.tokenRequests.at(-1).client_id, 'new-client');
            assert.equal(api.tokenRequests.at(-1).client_secret, 'new-secret');

            // The page closes itself when the editor opened it, and otherwise links back to the editor.
            assert.match(finished.body, /window\.opener/);
            assert.match(finished.body, /window\.close\(\)/);
            assert.ok(finished.body.includes('<a href="http://localhost:1880/#flow/%22tab%3C1%3E">Return to Node-RED</a>'));
            assert.ok(!finished.body.includes('tab<1>'));
            assert.ok(!finished.body.includes('new-secret'));
        });

        it('Should ask for the client secret when the client id is changed', async function () {
            const id = createEndpoint(null);

            const changedId = await RED.request('POST /tibber-api/:id/auth', { params: { id }, body: { clientId: 'other-client', clientSecret: '__PWRD__', redirectUri } });
            const changedBoth = await RED.request('POST /tibber-api/:id/auth', { params: { id }, body: { clientId: 'other-client', clientSecret: 'other-secret', redirectUri } });
            const unchanged = await RED.request('POST /tibber-api/:id/auth', { params: { id }, body: { clientId: 'client', clientSecret: '__PWRD__', redirectUri } });

            assert.equal(changedId.status, 400);
            assert.match(changedId.body.error, /Enter the Client Secret/);
            assert.equal(changedBoth.status, 200);
            assert.equal(unchanged.status, 200);
        });

        it('Should explain when Tibber does not accept the client id and secret', async function () {
            api.tokens = null;
            api.tokenError = 'invalid_client';
            try {
                const started = await RED.request('POST /tibber-api/:id/auth', { params: { id: 'x' }, body: { clientId: 'client', clientSecret: 'wrong', redirectUri, returnUrl: 'http://localhost:1880/' } });

                const finished = await RED.request('GET /tibber-api/callback', { query: { code: 'the-code', state: new URL(started.body.url).searchParams.get('state') } });

                assert.equal(finished.status, 400);
                assert.match(finished.body, /Tibber did not accept the Client ID and Client Secret \(invalid_client\)/);
                assert.match(finished.body, /Return to Node-RED/);
                assert.deepEqual(RED.nodes.getCredentials('x'), undefined);
                assert.equal(loadTokens(RED, 'x'), undefined);
            } finally {
                api.tokenError = undefined;
            }
        });

        it('Should only return the browser to a web address', async function () {
            const started = await RED.request('POST /tibber-api/:id/auth', {
                params: { id: 'x' },
                body: { clientId: 'client', redirectUri, returnUrl: 'javascript:alert(1)' },
            });

            const finished = await RED.request('GET /tibber-api/callback', { query: { code: 'the-code', state: new URL(started.body.url).searchParams.get('state') } });

            assert.equal(finished.status, 200);
            assert.ok(!finished.body.includes('javascript:'));
            assert.ok(!finished.body.includes('Return to Node-RED'));
        });

        it('Should use the stored client secret when the editor sends the placeholder', async function () {
            const id = createEndpoint(null);

            const started = await RED.request('POST /tibber-api/:id/auth', { params: { id }, body: { clientId: 'client', clientSecret: '__PWRD__', redirectUri } });
            await RED.request('GET /tibber-api/callback', { query: { code: 'the-code', state: new URL(started.body.url).searchParams.get('state') } });

            assert.equal(api.tokenRequests[0].client_secret, 'secret');
            assert.ok(RED.nodes.getNode(id).getDataClient());
        });

        it('Should finish a login from a pasted address', async function () {
            const id = createEndpoint(null);
            const started = await RED.request('POST /tibber-api/:id/auth', { params: { id }, body: { clientId: 'client', clientSecret: 'secret', redirectUri } });
            const state = new URL(started.body.url).searchParams.get('state');
            const pasted = `  ${redirectUri}?code=the-code&scope=openid&state=${state}\n`;

            const wrongEndpoint = await RED.request('POST /tibber-api/:id/auth/complete', { params: { id: 'other' }, body: { url: pasted } });
            const notAnAddress = await RED.request('POST /tibber-api/:id/auth/complete', { params: { id }, body: { url: 'the-code' } });
            assert.equal(wrongEndpoint.status, 400);
            assert.equal(notAnAddress.status, 400);
            assert.match(notAnAddress.body.error, /paste the whole address/);
            assert.equal(api.tokenRequests.length, 0);

            const finished = await RED.request('POST /tibber-api/:id/auth/complete', { params: { id }, body: { url: pasted } });

            assert.deepEqual(finished, { status: 200, body: { authorized: true } });
            assert.equal(api.tokenRequests[0].code, 'the-code');
            assert.equal(loadTokens(RED, id).accessToken, 'access');
            assert.equal(RED.nodes.getNode(id).currentAccessToken, 'access');
            assert.equal(RED.routes['POST /tibber-api/:id/auth/complete'].permission, 'tibber-api-endpoint.write');
        });

        it('Should also finish a login through the address served next to the HTTP In nodes', async function () {
            const id = createEndpoint(null);
            const started = await RED.request('POST /tibber-api/:id/auth', {
                params: { id },
                body: { clientId: 'client', clientSecret: 'secret', redirectUri: 'https://public.example.com/tibber-api/callback' },
            });
            const url = new URL(started.body.url);
            assert.equal(url.searchParams.get('redirect_uri'), 'https://public.example.com/tibber-api/callback');

            const finished = await RED.request('NODE GET /tibber-api/callback', { query: { code: 'the-code', state: url.searchParams.get('state') } });

            assert.equal(finished.status, 200);
            assert.equal(api.tokenRequests[0].redirect_uri, 'https://public.example.com/tibber-api/callback');
            assert.equal(RED.nodes.getNode(id).currentAccessToken, 'access');
            assert.equal((await RED.request('NODE GET /tibber-api/callback', { query: { code: 'x', state: 'guess' } })).status, 400);
        });

        it('Should use the access token unless the endpoint is set to log in', async function () {
            const legacy = RED.nodes.getNode(RED.createEndpoint('https://api.tibber.com/v1-beta/gql', 'personal-token'));
            const login = RED.nodes.getNode(createEndpoint());

            assert.equal(legacy.authType, 'token');
            assert.equal(legacy.currentAccessToken, 'personal-token');
            assert.equal(await legacy.getAccessToken(), 'personal-token');
            assert.equal(legacy.getDataClient(), undefined);
            assert.equal(login.authType, 'oauth');
            assert.equal(login.currentAccessToken, 'access');
            assert.equal(RED.nodes.getNode(createEndpoint(null)).currentAccessToken, undefined);
        });

        it('Should replace the login token before it expires', async function () {
            api.tokens = { access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600 };
            const timers = [];
            const realSetTimeout = global.setTimeout;
            global.setTimeout = (callback, delay) => timers.push({ callback, delay });
            let id;
            try {
                id = createEndpoint({ accessToken: 'access', refreshToken: 'refresh', expiresAt: Date.now() + 6 * 60000 });
            } finally {
                global.setTimeout = realSetTimeout;
            }

            // Five minutes before the token expires.
            assert.equal(timers.length, 1);
            assert.ok(timers[0].delay > 55000 && timers[0].delay <= 60000);
            await timers[0].callback();

            assert.equal(api.tokenRequests[0].refresh_token, 'refresh');
            assert.equal(RED.nodes.getNode(id).currentAccessToken, 'new-access');
            assert.equal(loadTokens(RED, id).refreshToken, 'new-refresh');
        });

        it('Should reject a login without a client id or a redirect address', async function () {
            const noClient = await RED.request('POST /tibber-api/:id/auth', { params: { id: 'x' }, body: { redirectUri } });
            const badRedirect = await RED.request('POST /tibber-api/:id/auth', { params: { id: 'x' }, body: { clientId: 'client', redirectUri: 'not an address' } });
            const noRedirect = await RED.request('POST /tibber-api/:id/auth', { params: { id: 'x' }, body: { clientId: 'client' } });

            assert.deepEqual([noClient.status, badRedirect.status, noRedirect.status], [400, 400, 400]);
        });

        it('Should reject a callback with an unknown state or an error from Tibber', async function () {
            const unknown = await RED.request('GET /tibber-api/callback', { query: { code: 'the-code', state: 'guess' } });
            assert.equal(unknown.status, 400);

            const started = await RED.request('POST /tibber-api/:id/auth', { params: { id: 'x' }, body: { clientId: 'client', redirectUri } });
            const denied = await RED.request('GET /tibber-api/callback', {
                query: { error: 'access_denied', error_description: '<b>denied</b>', state: new URL(started.body.url).searchParams.get('state') },
            });
            assert.equal(denied.status, 400);
            assert.match(denied.body, /&lt;b&gt;denied&lt;\/b&gt;/);
            assert.equal(api.tokenRequests.length, 0);
            assert.equal(loadTokens(RED, 'x'), undefined);
        });

        it('Should report a failed code exchange', async function () {
            api.tokens = null;
            const started = await RED.request('POST /tibber-api/:id/auth', { params: { id: 'x' }, body: { clientId: 'client', redirectUri } });

            const finished = await RED.request('GET /tibber-api/callback', { query: { code: 'the-code', state: new URL(started.body.url).searchParams.get('state') } });

            assert.equal(finished.status, 400);
            assert.match(finished.body, /Login failed: Token request failed: invalid_grant/);
            assert.equal(loadTokens(RED, 'x'), undefined);
        });

        it('Should remove the tokens when the node is deleted, but not when it is redeployed', async function () {
            const id = createEndpoint();

            await RED.close(RED.nodes.getNode(id), false);
            assert.ok(loadTokens(RED, id));

            await RED.close(RED.nodes.getNode(id), true);
            assert.equal(loadTokens(RED, id), undefined);
        });
    });

    describe('tibber-data-api', function () {
        it('Should return homes, devices and a device', async function () {
            api.reply = (req, res, url) => {
                if (url.pathname === '/v1/homes') json(res, { homes: [{ id: 'home1', name: 'Home' }] });
                else if (url.pathname === '/v1/homes/home1/devices') json(res, { devices: [{ id: 'dev1' }] });
                else if (url.pathname === '/v1/homes/home1/devices/dev1') json(res, { id: 'dev1', capabilities: [] });
                else if (url.pathname === '/v1/homes/home1/live-events/devices') json(res, { devices: [{ id: 'live1', type: 'tibber pulse' }] });
                else json(res, {}, 404);
            };
            const node = create('tibber-data-api', { apiEndpointRef: createEndpoint() });

            assert.equal(await RED.input(node, { payload: { queryName: 'getHomes' }, topic: 'keep' }), undefined);
            await RED.input(node, { payload: { queryName: 'getDevices', homeId: 'home1' } });
            await RED.input(node, { payload: { queryName: 'getDevice', homeId: 'home1', deviceId: 'dev1' } });
            await RED.input(node, { payload: { queryName: 'getLiveEventDevices', homeId: 'home1' } });

            assert.deepEqual(node.sent, [
                { payload: [{ id: 'home1', name: 'Home' }], topic: 'keep' },
                { payload: [{ id: 'dev1' }] },
                { payload: { id: 'dev1', capabilities: [] } },
                { payload: [{ id: 'live1', type: 'tibber pulse' }] },
            ]);
            assert.equal(api.requests[0].headers.authorization, 'Bearer access');
            assert.match(api.requests[0].headers['user-agent'], /bisand\/node-red-contrib-tibber-api\//);
        });

        it('Should prefer the values configured on the node', async function () {
            api.reply = (req, res) => json(res, { id: 'dev1' });
            const node = create('tibber-data-api', { apiEndpointRef: createEndpoint(), queryName: 'getDevice', homeId: 'home1', deviceId: 'dev1' });

            await RED.input(node, { payload: { queryName: 'getHomes', homeId: 'other', deviceId: 'other' } });

            assert.equal(api.requests[0].url, '/v1/homes/home1/devices/dev1');
        });

        it('Should return device history and follow a link', async function () {
            const history = { query: {}, items: [{ time: 'a', data: {} }], next: `${api.url}/v1/homes/home1/devices/dev1/history?cursor=abc` };
            api.reply = (req, res) => json(res, history);
            const node = create('tibber-data-api', { apiEndpointRef: createEndpoint(), queryName: 'getDeviceHistory', homeId: 'home1', deviceId: 'dev1' });

            const before = Date.now();
            await RED.input(node, { payload: {} });
            await RED.input(node, { payload: { resolution: 'day', since: '2026-10-01T00:00:00Z', until: 'ignored' } });
            await RED.input(node, { payload: { resolution: 'day', until: 1791763200000 } });
            await RED.input(node, { payload: { link: node.sent[0].payload.next } });

            assert.deepEqual(node.sent[0].payload, history);
            const first = new URL(api.requests[0].url, api.url);
            assert.equal(first.pathname, '/v1/homes/home1/devices/dev1/history');
            assert.equal(first.searchParams.get('resolution'), 'hour');
            assert.ok(new Date(first.searchParams.get('until')).getTime() >= before - 1000);
            assert.equal(api.requests[1].url, '/v1/homes/home1/devices/dev1/history?resolution=day&since=2026-10-01T00%3A00%3A00Z');
            assert.equal(api.requests[2].url, '/v1/homes/home1/devices/dev1/history?resolution=day&until=2026-10-12T00%3A00%3A00.000Z');
            assert.equal(api.requests[3].url, '/v1/homes/home1/devices/dev1/history?cursor=abc');
        });

        it('Should report an error when not logged in', async function () {
            const node = create('tibber-data-api', { apiEndpointRef: createEndpoint(null), queryName: 'getHomes' });
            const withoutEndpoint = create('tibber-data-api', { queryName: 'getHomes' });
            const withAccessToken = create('tibber-data-api', { apiEndpointRef: RED.createEndpoint('https://api.tibber.com/v1-beta/gql'), queryName: 'getHomes' });

            assert.match((await RED.input(node, { payload: {} })).message, /Not logged in/);
            assert.match((await RED.input(withoutEndpoint, {})).message, /Not logged in/);
            assert.match((await RED.input(withAccessToken, {})).message, /does not accept an access token/);
            assert.equal(api.requests.length, 0);
        });

        it('Should report an error for an unknown query or missing parameters', async function () {
            const node = create('tibber-data-api', { apiEndpointRef: createEndpoint() });

            assert.equal((await RED.input(node, { payload: 'getHomes' })).message, 'Unknown query: undefined');
            assert.equal((await RED.input(node, { payload: { queryName: 'toString' } })).message, 'Unknown query: toString');
            assert.equal((await RED.input(node, { payload: { queryName: 'getDevice', homeId: 'home1' } })).message, 'Missing mandatory parameters (deviceId)');
            assert.equal((await RED.input(node, { payload: { queryName: 'getDeviceHistory' } })).message, 'Missing mandatory parameters (homeId and/or deviceId)');
            assert.equal(api.requests.length, 0);
        });

        it('Should report an error from the API', async function () {
            api.reply = (req, res) => json(res, { title: 'Validation error', status: 400, detail: 'Invalid home ID format' }, 400);
            const node = create('tibber-data-api', { apiEndpointRef: createEndpoint() });

            const error = await RED.input(node, { payload: { queryName: 'getDevices', homeId: 'bad' } });

            assert.match(error.message, /Invalid home ID format/);
            assert.equal(error.status, 400);
            assert.deepEqual(node.sent, []);
        });

        it('Should refresh an expired access token and store the new tokens', async function () {
            api.tokens = { access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600 };
            api.reply = (req, res) => json(res, { homes: [] });
            const endpointId = createEndpoint({ accessToken: 'old-access', refreshToken: 'old-refresh', expiresAt: Date.now() - 1000 });
            const node = create('tibber-data-api', { apiEndpointRef: endpointId, queryName: 'getHomes' });

            assert.equal(await RED.input(node, { payload: {} }), undefined);

            assert.deepEqual(api.tokenRequests[0], { grant_type: 'refresh_token', refresh_token: 'old-refresh', client_id: 'client', client_secret: 'secret' });
            assert.equal(api.requests[0].headers.authorization, 'Bearer new-access');
            assert.equal(loadTokens(RED, endpointId).refreshToken, 'new-refresh');

            // A restart reads the new tokens from the file.
            await RED.close(RED.nodes.getNode(endpointId));
            assert.equal(RED.nodes.getNode(endpointId).getDataClient().tokens.refreshToken, 'new-refresh');
        });
    });

    describe('tibber-data-api-feed', function () {
        function stream(events) {
            return (req, res, url) => {
                if (url.pathname === '/v1/homes') json(res, { homes: [{ id: 'home1', name: 'Home' }] });
                else if (url.pathname === '/v1/homes/home1/live-events/devices') json(res, { devices: [{ id: 'live1', type: 'tibber pulse' }, { id: 'live2', type: 'watty' }] });
                else if (url.pathname === '/v1/homes/home1/live-events') {
                    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
                    for (const [event, data] of events) {
                        res.write(`event: ${event}\ndata: ${data ? JSON.stringify(data) : ''}\n\n`);
                    }
                } else json(res, {}, 404);
            };
        }

        it('Should stream measurements from the devices that can stream', { timeout: 15000 }, async function () {
            api.reply = stream([['ping'], ['measurement', { deviceId: 'live1', power: 275 }]]);
            const node = create('tibber-data-api-feed', { active: true, apiEndpointRef: createEndpoint() });

            await waitFor(() => node.sent.length > 0);

            assert.deepEqual(node.sent[0], { topic: 'live1', payload: { deviceId: 'live1', power: 275 } });
            assert.deepEqual(node.statuses.at(-1), { fill: 'green', shape: 'dot', text: 'connected' });
            assert.equal(api.requests.at(-1).url, '/v1/homes/home1/live-events?deviceId=live1&deviceId=live2');
            assert.equal(api.requests.at(-1).headers.authorization, 'Bearer access');
        });

        it('Should use the configured home and devices', { timeout: 15000 }, async function () {
            api.reply = (req, res, url) => stream([['measurement', { deviceId: 'a', power: 1 }]])(req, res, new URL(url.href.replace('home2', 'home1')));
            const node = create('tibber-data-api-feed', { active: true, apiEndpointRef: createEndpoint(), homeId: 'home2', deviceIds: 'a, b' });

            await waitFor(() => node.sent.length > 0);

            assert.deepEqual(api.requests.map((r) => r.url), ['/v1/homes/home2/live-events?deviceId=a&deviceId=b']);
        });

        it('Should stop and show the reason when another feed takes over', { timeout: 15000 }, async function () {
            api.reply = stream([['stream_error', { code: 'evicted', transient: false }]]);
            const node = create('tibber-data-api-feed', { active: true, apiEndpointRef: createEndpoint() });

            await waitFor(() => node.errors.length > 0);
            const streams = api.requests.filter((r) => r.url.includes('/live-events?')).length;
            await new Promise((resolve) => setTimeout(resolve, 2500));

            assert.equal(streams, 1);
            assert.equal(api.requests.filter((r) => r.url.includes('/live-events?')).length, 1);
            assert.match(node.errors[0], /evicted/);
            assert.deepEqual(node.statuses.at(-1), { fill: 'red', shape: 'dot', text: 'evicted' });
        });

        it('Should show the status when not logged in', { timeout: 15000 }, async function () {
            const node = create('tibber-data-api-feed', { active: true, apiEndpointRef: createEndpoint(null) });

            await waitFor(() => node.statuses.length > 1);

            assert.deepEqual(node.statuses.at(-1), { fill: 'red', shape: 'dot', text: 'not logged in' });
            assert.equal(api.requests.length, 0);
        });

        it('Should report an error when no device can stream', { timeout: 15000 }, async function () {
            api.reply = (req, res, url) => json(res, url.pathname === '/v1/homes' ? { homes: [{ id: 'home1' }] } : { devices: [] });
            const node = create('tibber-data-api-feed', { active: true, apiEndpointRef: createEndpoint() });

            await waitFor(() => node.errors.length > 0);

            assert.match(node.errors[0], /No devices can stream live measurements/);
            assert.deepEqual(node.statuses.at(-1), { fill: 'red', shape: 'dot', text: 'error' });
        });

        it('Should close the stream when the node is closed', { timeout: 15000 }, async function () {
            let closed = false;
            api.reply = (req, res, url) => {
                if (url.pathname.endsWith('/live-events')) res.on('close', () => (closed = true));
                stream([['measurement', { deviceId: 'live1', power: 1 }]])(req, res, url);
            };
            const node = create('tibber-data-api-feed', { active: true, apiEndpointRef: createEndpoint() });
            await waitFor(() => node.sent.length > 0);

            await RED.close(node);
            nodes.length = 0;
            await waitFor(() => closed);
            await new Promise((resolve) => setTimeout(resolve, 1500));

            assert.equal(api.requests.filter((r) => r.url.includes('/live-events?')).length, 1);
            assert.deepEqual(node.statuses.at(-1), { fill: 'red', shape: 'ring', text: 'disconnected' });
        });

        it('Should not connect when the node is inactive', { timeout: 15000 }, async function () {
            const node = create('tibber-data-api-feed', { active: false, apiEndpointRef: createEndpoint() });

            await new Promise((resolve) => setTimeout(resolve, 1500));

            assert.equal(api.requests.length, 0);
            assert.deepEqual(node.sent, []);
        });
    });

    describe('login with the GraphQL nodes', function () {
        let gql;
        let wss;
        let initTokens;
        let rejectToken;

        before(async function () {
            gql = await createApiServer();
            wss = new WebSocket.Server({ port: 0 });
            await new Promise((resolve) => wss.on('listening', resolve));
            wss.on('connection', (socket) => {
                socket.on('message', (data) => {
                    const msg = JSON.parse(data);
                    if (msg.type === 'connection_init') {
                        initTokens.push(msg.payload.token);
                        if (msg.payload.token === rejectToken) {
                            socket.close(4403, 'Invalid token');
                        } else {
                            socket.send(JSON.stringify({ type: 'connection_ack' }));
                        }
                    } else if (msg.type === 'subscribe') {
                        socket.send(JSON.stringify({ id: msg.id, type: 'next', payload: { data: { liveMeasurement: { power: 1337 } } } }));
                    }
                });
            });
        });

        after(async function () {
            for (const client of wss.clients) {
                client.terminate();
            }
            await new Promise((resolve) => wss.close(resolve));
            await gql.close();
        });

        beforeEach(function () {
            initTokens = [];
            rejectToken = undefined;
            gql.requests.length = 0;
            gql.reply = (body) => {
                if (body.query.includes('query getHomes')) return { status: 200, body: { data: { viewer: { homes: [{ id: 'home1' }] } } } };
                if (body.query.includes('websocketSubscriptionUrl')) return { status: 200, body: { data: { viewer: { websocketSubscriptionUrl: `ws://127.0.0.1:${wss.address().port}` } } } };
                if (body.query.includes('realTimeConsumptionEnabled')) return { status: 200, body: { data: { viewer: { home: { features: { realTimeConsumptionEnabled: true } } } } } };
                return { status: 200, body: { data: {} } };
            };
        });

        function createGraphQLEndpoint(tokens) {
            const id = RED.createLoginEndpoint(tokens, { queryUrl: gql.url });
            endpoints.push(id);
            return id;
        }

        it('Should query with the login token and refresh it when it has expired', async function () {
            api.tokens = { access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600 };
            const endpointId = createGraphQLEndpoint();
            const node = create('tibber-data', { apiEndpointRef: endpointId, queryName: 'getHomes' });

            assert.equal(await RED.input(node, { payload: {} }), undefined);
            assert.deepEqual(node.sent[0].payload, [{ id: 'home1' }]);
            assert.equal(gql.requests[0].headers.authorization, 'Bearer access');
            assert.equal(api.tokenRequests.length, 0);

            // The token expires. The next query gets a new one first.
            RED.nodes.getNode(endpointId).getDataClient().tokens.expiresAt = Date.now() - 1000;
            assert.equal(await RED.input(node, { payload: {} }), undefined);

            assert.equal(api.tokenRequests.length, 1);
            assert.equal(gql.requests[1].headers.authorization, 'Bearer new-access');
            assert.equal(loadTokens(RED, endpointId).refreshToken, 'new-refresh');
        });

        it('Should report an error when the endpoint is not logged in', function () {
            const node = create('tibber-query', { apiEndpointRef: createGraphQLEndpoint(null) });

            assert.match(node.errors[0], /Missing mandatory parameters/);
        });

        it('Should start working after a login without a deploy', { timeout: 15000 }, async function () {
            api.reply = (req, res, url) => {
                if (url.pathname === '/v1/homes') json(res, { homes: [{ id: 'home1', name: 'Home' }] });
                else if (url.pathname === '/v1/homes/home1/live-events/devices') json(res, { devices: [{ id: 'live1', type: 'tibber pulse' }] });
                else if (url.pathname === '/v1/homes/home1/live-events') {
                    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
                    res.write(`event: measurement\ndata: ${JSON.stringify({ deviceId: 'live1', power: 275 })}\n\n`);
                } else json(res, {}, 404);
            };
            // Deployed with the client ID and secret, but before the user has logged in.
            const endpointId = createGraphQLEndpoint(null);
            const query = create('tibber-data', { apiEndpointRef: endpointId, queryName: 'getHomes' });
            const dataApi = create('tibber-data-api', { apiEndpointRef: endpointId, queryName: 'getHomes' });
            const feed = create('tibber-feed', { active: true, homeId: 'home1', power: '1', apiEndpointRef: endpointId });
            const dataApiFeed = create('tibber-data-api-feed', { active: true, apiEndpointRef: endpointId });
            await waitFor(() => dataApiFeed.statuses.some((status) => status.text === 'not logged in'));
            assert.match((await RED.input(query, { payload: {} })).message, /Missing mandatory parameters/);
            assert.match((await RED.input(dataApi, { payload: {} })).message, /Not logged in/);

            // The user logs in from the editor.
            const started = await RED.request('POST /tibber-api/:id/auth', { params: { id: endpointId }, body: { clientId: 'client', clientSecret: '__PWRD__', redirectUri } });
            await RED.request('GET /tibber-api/callback', { query: { code: 'the-code', state: new URL(started.body.url).searchParams.get('state') } });

            await waitFor(() => feed.sent.length > 0 && dataApiFeed.sent.length > 0);
            assert.equal(await RED.input(query, { payload: {} }), undefined);
            assert.equal(await RED.input(dataApi, { payload: {} }), undefined);

            assert.deepEqual(query.sent[0].payload, [{ id: 'home1' }]);
            assert.deepEqual(dataApi.sent[0].payload, [{ id: 'home1', name: 'Home' }]);
            assert.deepEqual(feed.sent[0], { payload: { power: 1337 } });
            assert.deepEqual(dataApiFeed.sent[0], { topic: 'live1', payload: { deviceId: 'live1', power: 275 } });
            assert.deepEqual(dataApiFeed.statuses.at(-1), { fill: 'green', shape: 'dot', text: 'connected' });

            // Closing the nodes stops them listening to the endpoint.
            await RED.close(feed);
            await RED.close(dataApiFeed);
            nodes.splice(nodes.indexOf(feed), 1);
            nodes.splice(nodes.indexOf(dataApiFeed), 1);
            assert.equal(RED.nodes.getNode(endpointId).listenerCount('tibber:login'), 0);
        });

        it('Should run the live feed with the login token', { timeout: 15000 }, async function () {
            const endpointId = createGraphQLEndpoint();
            const first = create('tibber-feed', { active: true, homeId: 'home1', power: '1', apiEndpointRef: endpointId });
            const second = create('tibber-feed', { active: true, homeId: 'home1', power: '1', apiEndpointRef: endpointId });

            await waitFor(() => first.sent.length > 0 && second.sent.length > 0);

            assert.deepEqual(initTokens, ['access']);
            assert.deepEqual(first.sent[0], { payload: { power: 1337 } });
            assert.deepEqual(Object.keys(RED.types['tibber-feed'].constructor.instances), [`endpoint:${endpointId}`]);
            assert.ok(!first.logs.concat(second.logs).some((line) => line.includes('access')));
        });

        it('Should refresh a rejected login token and reconnect the live feed', { timeout: 15000 }, async function () {
            api.tokens = { access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600 };
            rejectToken = 'access';
            const node = create('tibber-feed', { active: true, homeId: 'home1', power: '1', apiEndpointRef: createGraphQLEndpoint() });

            await waitFor(() => node.sent.length > 0);

            assert.deepEqual(initTokens, ['access', 'new-access']);
            assert.equal(api.tokenRequests.length, 1);
            assert.deepEqual(node.errors, []);
            assert.deepEqual(node.statuses.at(-1), { fill: 'green', shape: 'dot', text: 'connected' });
        });

        it('Should stop the live feed when the login can not be refreshed', { timeout: 15000 }, async function () {
            api.tokens = null;
            rejectToken = 'access';
            const node = create('tibber-feed', { active: true, homeId: 'home1', power: '1', apiEndpointRef: createGraphQLEndpoint() });

            await waitFor(() => node.errors.length > 0);
            await new Promise((resolve) => setTimeout(resolve, 2500));

            assert.deepEqual(initTokens, ['access']);
            assert.match(node.errors[0], /invalid_grant/);
            assert.deepEqual(node.statuses.at(-1), { fill: 'red', shape: 'dot', text: 'invalid token' });
        });
    });
});
