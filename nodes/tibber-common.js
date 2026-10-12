const { version } = require('../package.json');

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
    const credentials = RED.nodes.getCredentials(config.apiEndpointRef);
    const accessToken = overrides.accessToken || (credentials && credentials.accessToken);
    if (!endpoint || !endpoint.queryUrl || !accessToken) {
        return undefined;
    }
    return {
        ...config,
        homeId: overrides.homeId || config.homeId,
        apiEndpoint: { queryUrl: endpoint.queryUrl, apiKey: accessToken, userAgent },
    };
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

module.exports = { userAgent, getApiConfig, getTimeout, toError, getPayload };
