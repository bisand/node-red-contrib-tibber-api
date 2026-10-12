const TibberQuery = require('tibber-api').TibberQuery;
const { version } = require('../package.json');

const MISSING_PARAMETERS = 'Missing mandatory parameters (queryUrl and/or accessToken). Log in or enter an access token on the API endpoint.';
// Emitted by the API endpoint node when the user has logged in.
const LOGIN_EVENT = 'tibber:login';

const userAgent = `bisand/node-red-contrib-tibber-api/${version}`;

/**
 * Build the config object for tibber-api from a node's config and its API endpoint node.
 * @param RED Node-RED runtime
 * @param config Config of the node
 * @param overrides Values that replace the configured accessToken and homeId
 * @returns Config object, or undefined if the endpoint or the access token is missing
 */
function getApiConfig(RED, config, overrides = {}) {
    const endpoint = RED.nodes.getNode(config.apiEndpointRef);
    const fixedToken = overrides.accessToken;
    if (!endpoint || !endpoint.queryUrl || !(fixedToken || endpoint.currentAccessToken)) {
        return undefined;
    }
    const apiEndpoint = { queryUrl: endpoint.queryUrl, userAgent };
    // tibber-api reads the key on every request and connect. A login token is replaced
    // about once an hour, so always hand out the current one.
    Object.defineProperty(apiEndpoint, 'apiKey', { enumerable: true, get: () => fixedToken || endpoint.currentAccessToken });
    return {
        ...config,
        homeId: overrides.homeId || config.homeId,
        apiEndpoint,
    };
}

/**
 * Get the TibberQuery client of a node, creating it when the API endpoint is ready.
 * The endpoint may become ready after the node has started, when the user logs in.
 * @returns TibberQuery object, or undefined if the endpoint or its token is missing
 */
function getQueryClient(RED, node, config) {
    if (!node.client) {
        const apiConfig = getApiConfig(RED, config);
        if (apiConfig) {
            node.client = new TibberQuery(apiConfig, getTimeout(RED, config, 'queryRequestTimeout', 30));
        }
    }
    return node.client;
}

/**
 * Call a function when the user logs in on the API endpoint selected on a node.
 * @returns Function that stops listening
 */
function onLogin(RED, config, listener) {
    const endpoint = RED.nodes.getNode(config.apiEndpointRef);
    if (!endpoint || typeof endpoint.on !== 'function') {
        return () => {};
    }
    endpoint.on(LOGIN_EVENT, listener);
    return () => endpoint.removeListener(LOGIN_EVENT, listener);
}

/**
 * Make sure the access token of the API endpoint selected on a node is valid, refreshing a login token if needed.
 */
async function ensureAccessToken(RED, config) {
    const endpoint = RED.nodes.getNode(config.apiEndpointRef);
    if (endpoint && typeof endpoint.getAccessToken === 'function') {
        await endpoint.getAccessToken();
    }
}

/**
 * Get the Tibber Data API client from the API endpoint selected on a node.
 * @returns TibberData object, or undefined if the endpoint does not use a login or the user has not logged in
 */
function getDataClient(RED, config) {
    const endpoint = RED.nodes.getNode(config.apiEndpointRef);
    return endpoint && typeof endpoint.getDataClient === 'function' ? endpoint.getDataClient() : undefined;
}

/**
 * Explain why getDataClient returned nothing.
 */
function getDataClientError(RED, config) {
    const endpoint = RED.nodes.getNode(config.apiEndpointRef);
    return endpoint && endpoint.authType !== 'oauth'
        ? 'The Tibber Data API does not accept an access token. Select an API endpoint that logs in with client ID and secret.'
        : 'Not logged in to Tibber. Open the API endpoint and log in.';
}

/**
 * Get a timeout configured in seconds on the API endpoint node, in milliseconds.
 */
function getTimeout(RED, config, name, defaultSeconds) {
    const endpoint = RED.nodes.getNode(config.apiEndpointRef);
    const seconds = Number(endpoint && endpoint[name]);
    return (seconds > 0 ? seconds : defaultSeconds) * 1000;
}

/**
 * Convert an error from tibber-api to an Error with a readable message, so it can be handled by Catch nodes.
 */
function toError(error) {
    if (error instanceof Error) {
        return error;
    }
    let message;
    if (typeof error === 'string') {
        message = error;
    } else if (error && Array.isArray(error.errors) && error.errors.length > 0) {
        message = error.errors.map((e) => e && e.message).join(', ');
    } else if (error && (error.message || error.responseMessage || error.statusMessage)) {
        message = error.message || error.responseMessage || error.statusMessage;
    } else {
        message = JSON.stringify(error);
    }
    const result = new Error(message);
    if (error && typeof error === 'object') {
        result.statusCode = error.statusCode;
        result.errors = error.errors;
    }
    return result;
}

/**
 * Get msg.payload as an object. Returns an empty object for other kinds of payloads.
 */
function getPayload(msg) {
    return msg && msg.payload && typeof msg.payload === 'object' ? msg.payload : {};
}

module.exports = { userAgent, MISSING_PARAMETERS, LOGIN_EVENT, getApiConfig, getQueryClient, onLogin, ensureAccessToken, getDataClient, getDataClientError, getTimeout, toError, getPayload };
