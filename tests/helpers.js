const { EventEmitter } = require('events');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

/**
 * Minimal stand-in for the Node-RED runtime, enough to construct the nodes and send them messages.
 */
function createRED(settings = {}) {
    const types = {};
    const nodes = {};
    const credentials = {};
    const routes = {};
    const RED = {
        types,
        routes,
        settings: { userDir: fs.mkdtempSync(path.join(os.tmpdir(), 'tibber-node-red-')), ...settings },
        auth: { needsPermission: (permission) => permission },
        // Collects the admin routes. The last argument is the handler, any before it are permissions.
        httpAdmin: {
            get: (route, ...handlers) => (routes[`GET ${route}`] = { permission: handlers.length > 1 ? handlers[0] : undefined, handler: handlers.at(-1) }),
            post: (route, ...handlers) => (routes[`POST ${route}`] = { permission: handlers.length > 1 ? handlers[0] : undefined, handler: handlers.at(-1) }),
        },
        // Routes served next to the HTTP In nodes.
        httpNode: {
            get: (route, handler) => (routes[`NODE GET ${route}`] = { handler }),
        },
        nodes: {
            createNode(node, config) {
                const emitter = new EventEmitter();
                node.id = config.id;
                node.credentials = credentials[config.id] || {};
                node.on = (event, listener) => emitter.on(event, listener);
                node.emit = (event, ...args) => emitter.emit(event, ...args);
                node.sent = [];
                node.errors = [];
                node.logs = [];
                node.statuses = [];
                node.send = (msg) => node.sent.push(msg);
                node.error = (error) => node.errors.push(error);
                node.warn = (message) => node.logs.push(String(message));
                node.log = (message) => node.logs.push(String(message));
                node.debug = (message) => node.logs.push(String(message));
                node.status = (status) => node.statuses.push(status);
                nodes[config.id] = node;
            },
            registerType(name, constructor, options) {
                types[name] = { constructor, options };
            },
            getNode: (id) => nodes[id],
            removeNode: (id) => delete nodes[id],
            getCredentials: (id) => credentials[id],
            addCredentials(id, values) {
                credentials[id] = { ...credentials[id], ...values };
            },
        },
    };
    [
        'tibber-api-endpoint',
        'tibber-query',
        'tibber-data',
        'tibber-notify',
        'tibber-update-home',
        'tibber-feed',
        'tibber-data-api',
        'tibber-data-api-feed',
    ].forEach((name) => require(`../nodes/${name}.js`)(RED));

    /** Create a node of the given type. */
    RED.create = (type, config) => new types[type].constructor({ id: `${type}-${Object.keys(nodes).length}`, type, ...config });

    /** Create an API endpoint node that logs in with client ID and secret, logged in unless tokens is null. Returns its id. */
    RED.createLoginEndpoint = (tokens = { accessToken: 'access', refreshToken: 'refresh', expiresAt: Date.now() + 3600000 }, config = {}) => {
        const id = `login-endpoint-${Object.keys(nodes).length}`;
        RED.nodes.addCredentials(id, { clientId: 'client', clientSecret: 'secret' });
        if (tokens) {
            require('../nodes/tibber-token-store').saveTokens(RED, id, tokens);
        }
        new types['tibber-api-endpoint'].constructor({ id, type: 'tibber-api-endpoint', authType: 'oauth', queryUrl: 'https://api.tibber.com/v1-beta/gql', ...config });
        return id;
    };

    /** Create an API endpoint node with an access token. Returns its id. */
    RED.createEndpoint = (queryUrl, accessToken = 'token', config = {}) => {
        const id = `endpoint-${Object.keys(nodes).length}`;
        if (accessToken) {
            RED.nodes.addCredentials(id, { accessToken });
        }
        new types['tibber-api-endpoint'].constructor({ id, type: 'tibber-api-endpoint', queryUrl, ...config });
        return id;
    };

    /** Send a message to a node. Resolves with the error passed to done, if any, when the node is done. */
    RED.input = (node, msg) =>
        new Promise((resolve) => {
            const send = (m) => node.send(m);
            node.emit('input', msg, send, (error) => resolve(error));
        });

    /** Close a node. */
    RED.close = (node, removed = false) =>
        new Promise((resolve) => {
            // emit returns false when the node has no close handler.
            if (!node.emit('close', removed, resolve)) resolve();
        });

    /** Call an admin route. Resolves with the status and body of the response. */
    RED.request = (route, req = {}) =>
        new Promise((resolve) => {
            const res = {
                statusCode: 200,
                status(code) {
                    this.statusCode = code;
                    return this;
                },
                json: (body) => resolve({ status: res.statusCode, body }),
                send: (body) => resolve({ status: res.statusCode, body }),
            };
            routes[route].handler({ params: {}, query: {}, body: {}, ...req }, res);
        });

    return RED;
}

/**
 * Local HTTP server that answers GraphQL requests.
 * Set server.reply to a function (body, req) => ({ status, body }) to control the response.
 */
async function createApiServer() {
    const state = { requests: [], reply: () => ({ status: 200, body: { data: {} } }) };
    const server = http.createServer((req, res) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => {
            const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
            state.requests.push({ body, headers: req.headers });
            const { status, body: responseBody } = state.reply(body, req);
            res.writeHead(status, { 'Content-Type': 'application/json' });
            res.end(typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody));
        });
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    state.url = `http://127.0.0.1:${server.address().port}/gql`;
    state.close = () =>
        new Promise((resolve) => {
            server.closeAllConnections();
            server.close(resolve);
        });
    return state;
}

/**
 * Local HTTP server that stands in for the Tibber Data API and its token endpoint.
 * Set server.reply to a function (req, res, url) to answer API requests, and server.tokens to the token response.
 */
async function createDataApiServer() {
    const state = { requests: [], tokenRequests: [], reply: (req, res) => res.end('{}'), tokens: { access_token: 'access', refresh_token: 'refresh', expires_in: 3600 } };
    const server = http.createServer((req, res) => {
        const url = new URL(req.url, 'http://localhost');
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => {
            if (url.pathname === '/connect/token') {
                state.tokenRequests.push(Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString())));
                res.writeHead(state.tokens ? 200 : 400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(state.tokens || { error: 'invalid_grant' }));
                return;
            }
            state.requests.push({ url: req.url, headers: req.headers });
            state.reply(req, res, url);
        });
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    state.url = `http://127.0.0.1:${server.address().port}`;
    state.settings = { tibberDataApi: { apiUrl: state.url, tokenUrl: `${state.url}/connect/token` } };
    state.close = () =>
        new Promise((resolve) => {
            server.closeAllConnections();
            server.close(resolve);
        });
    return state;
}

module.exports = { createRED, createApiServer, createDataApiServer };
