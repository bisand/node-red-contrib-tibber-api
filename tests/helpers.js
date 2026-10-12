const { EventEmitter } = require('events');
const http = require('http');

/**
 * Minimal stand-in for the Node-RED runtime, enough to construct the nodes and send them messages.
 */
function createRED() {
    const types = {};
    const nodes = {};
    const credentials = {};
    const RED = {
        types,
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
            getCredentials: (id) => credentials[id],
            addCredentials(id, values) {
                credentials[id] = { ...credentials[id], ...values };
            },
        },
    };
    ['tibber-api-endpoint', 'tibber-query', 'tibber-data', 'tibber-notify', 'tibber-update-home', 'tibber-feed'].forEach((name) => require(`../nodes/${name}.js`)(RED));

    /** Create a node of the given type. */
    RED.create = (type, config) => new types[type].constructor({ id: `${type}-${Object.keys(nodes).length}`, type, ...config });

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
    RED.close = (node) => new Promise((resolve) => node.emit('close', false, resolve));

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

module.exports = { createRED, createApiServer };
