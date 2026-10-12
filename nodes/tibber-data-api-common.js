const fs = require('fs');
const path = require('path');

const TOKEN_FILE = 'tibber-data-api-tokens.json';

// Tibber replaces the refresh token on every refresh, and Node-RED only saves credentials on deploy.
// The tokens are therefore kept in a file in the user directory, so they survive a restart.
function getTokenFile(RED) {
    return path.join((RED.settings && RED.settings.userDir) || process.cwd(), TOKEN_FILE);
}

function readTokenFile(RED) {
    try {
        return JSON.parse(fs.readFileSync(getTokenFile(RED), 'utf-8')) || {};
    } catch {
        return {};
    }
}

function writeTokenFile(RED, content) {
    const file = getTokenFile(RED);
    const temp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(content, null, 2), { mode: 0o600 });
    fs.renameSync(temp, file);
}

/**
 * Get the tokens stored for a Data API endpoint node.
 */
function loadTokens(RED, id) {
    return readTokenFile(RED)[id];
}

/**
 * Store the tokens for a Data API endpoint node.
 */
function saveTokens(RED, id, tokens) {
    const content = readTokenFile(RED);
    content[id] = tokens;
    writeTokenFile(RED, content);
}

/**
 * Remove the tokens stored for a Data API endpoint node.
 */
function deleteTokens(RED, id) {
    const content = readTokenFile(RED);
    if (content[id]) {
        delete content[id];
        writeTokenFile(RED, content);
    }
}

/**
 * URLs from the optional tibberDataApi object in the Node-RED settings file: apiUrl, authorizeUrl and tokenUrl.
 */
function getUrls(RED) {
    return (RED.settings && RED.settings.tibberDataApi) || {};
}

/**
 * Get the Data API client from the endpoint node selected on a node.
 * @returns TibberData object, or undefined if the endpoint is missing or the user has not logged in
 */
function getClient(RED, config) {
    const endpoint = RED.nodes.getNode(config.apiEndpointRef);
    return endpoint && typeof endpoint.getClient === 'function' ? endpoint.getClient() : undefined;
}

module.exports = { TOKEN_FILE, loadTokens, saveTokens, deleteTokens, getUrls, getClient };
