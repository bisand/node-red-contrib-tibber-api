const { TibberOAuth, TibberData } = require('tibber-api');
const { userAgent, toError } = require('./tibber-common');
const { loadTokens, saveTokens, deleteTokens, getUrls } = require('./tibber-data-api-common');

const CALLBACK_PATH = '/tibber-data-api/callback';
const PENDING_TIMEOUT = 10 * 60 * 1000; // 10 minutes

function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

module.exports = function (RED) {
    function createOAuth(clientId, clientSecret, redirectUri, scopes) {
        const urls = getUrls(RED);
        return new TibberOAuth({
            clientId,
            clientSecret,
            redirectUri,
            scopes: scopes ? String(scopes).split(/[\s,]+/).filter(Boolean) : undefined,
            userAgent,
            authorizeUrl: urls.authorizeUrl,
            tokenUrl: urls.tokenUrl,
        });
    }

    function TibberDataApiEndpointNode(config) {
        RED.nodes.createNode(this, config);

        /**
         * Get the Data API client. Returns undefined until the client is configured and the user has logged in.
         */
        this.getClient = () => {
            if (this._client) {
                return this._client;
            }
            const tokens = loadTokens(RED, this.id);
            const credentials = this.credentials || {};
            if (!tokens || !tokens.accessToken || !credentials.clientId) {
                return undefined;
            }
            this._client = new TibberData({
                tokens,
                // The redirect URI is only used when logging in.
                oauth: createOAuth(credentials.clientId, credentials.clientSecret, 'http://localhost'),
                onTokensRefreshed: (newTokens) => saveTokens(RED, this.id, newTokens),
                userAgent,
                apiUrl: getUrls(RED).apiUrl,
            });
            return this._client;
        };

        this.on('close', (removed, done) => {
            this._client = undefined;
            if (removed) {
                deleteTokens(RED, this.id);
            }
            done();
        });
    }
    RED.nodes.registerType('tibber-data-api-endpoint', TibberDataApiEndpointNode, {
        credentials: {
            clientId: { type: 'text' },
            clientSecret: { type: 'password' },
        },
    });

    // Logins that have been started from the editor, by OAuth state.
    const pending = new Map();

    // Start a login. Returns the URL the user must open to log in to Tibber.
    RED.httpAdmin.post('/tibber-data-api/:id/auth', RED.auth.needsPermission('tibber-data-api-endpoint.write'), (req, res) => {
        const body = req.body || {};
        const stored = RED.nodes.getCredentials(req.params.id) || {};
        const clientId = body.clientId || stored.clientId;
        // The editor sends a placeholder when the stored secret has not been changed.
        const clientSecret = body.clientSecret && body.clientSecret !== '__PWRD__' ? body.clientSecret : stored.clientSecret;
        let redirectUri;
        try {
            redirectUri = new URL(body.redirectUri);
        } catch {
            redirectUri = undefined;
        }
        if (!clientId || !redirectUri || !redirectUri.pathname.endsWith(CALLBACK_PATH)) {
            res.status(400).json({ error: 'Missing mandatory parameters (clientId and/or redirectUri)' });
            return;
        }

        const now = Date.now();
        for (const [state, login] of pending) {
            if (now - login.created > PENDING_TIMEOUT) pending.delete(state);
        }

        const oauth = createOAuth(clientId, clientSecret, redirectUri.href, body.scopes);
        const { url, state, codeVerifier } = oauth.createAuthorizationUrl();
        pending.set(state, { id: req.params.id, oauth, codeVerifier, created: now });
        res.json({ url });
    });

    // Tibber redirects the browser here after the login. The state identifies a login started above.
    RED.httpAdmin.get(CALLBACK_PATH, async (req, res) => {
        const query = req.query || {};
        const login = pending.get(query.state);
        pending.delete(query.state);
        if (!login || Date.now() - login.created > PENDING_TIMEOUT) {
            res.status(400).send('Login failed: unknown or expired login. Start again from the Node-RED editor.');
            return;
        }
        try {
            if (!query.code) {
                throw new Error(query.error_description || query.error || 'No code received from Tibber');
            }
            saveTokens(RED, login.id, await login.oauth.exchangeCode(query.code, login.codeVerifier));
            const node = RED.nodes.getNode(login.id);
            if (node) {
                node._client = undefined;
            }
            res.send('Logged in to Tibber. You can close this window and return to Node-RED.');
        } catch (error) {
            res.status(400).send(`Login failed: ${escapeHtml(toError(error).message)}`);
        }
    });

    // Tells the editor whether the user has logged in.
    RED.httpAdmin.get('/tibber-data-api/:id/status', RED.auth.needsPermission('tibber-data-api-endpoint.read'), (req, res) => {
        const tokens = loadTokens(RED, req.params.id);
        res.json({ authorized: !!(tokens && tokens.accessToken) });
    });
};
