const { TibberOAuth, TibberData } = require('tibber-api');
const { userAgent, toError } = require('./tibber-common');
const { loadTokens, saveTokens, deleteTokens, getUrls } = require('./tibber-token-store');

const PENDING_TIMEOUT = 10 * 60 * 1000; // 10 minutes
// Replace a login token this long before it expires, so the live feed can always reconnect.
const REFRESH_MARGIN = 5 * 60 * 1000; // 5 minutes
const REFRESH_MIN_DELAY = 30 * 1000; // 30 seconds
const REFRESH_RETRY_DELAY = 60 * 1000; // 1 minute

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

    function TibberApiEndpointNode(config) {
        RED.nodes.createNode(this, config);

        if (this.credentials && !this.credentials.accessToken && config.apiKey) {
            RED.nodes.addCredentials(this.id, { accessToken: config.apiKey });
        }

        // delete properties, just in case.
        delete config.apiKey;
        delete this.apiKey;

        this.queryUrl = config.queryUrl;
        this.feedTimeout = config.feedTimeout;
        this.feedConnectionTimeout = config.feedConnectionTimeout;
        this.queryRequestTimeout = config.queryRequestTimeout;
        this.userAgent = userAgent;
        // Endpoints created before the login was added have no authType and use the access token.
        this.authType = config.authType === 'oauth' ? 'oauth' : 'token';

        const getCredentials = () => RED.nodes.getCredentials(this.id) || {};

        /**
         * Get the Tibber Data API client. Returns undefined unless the endpoint uses a login and the user has logged in.
         */
        this.getDataClient = () => {
            if (this.authType !== 'oauth') {
                return undefined;
            }
            if (this._client) {
                return this._client;
            }
            const tokens = loadTokens(RED, this.id);
            const credentials = getCredentials();
            if (!tokens || !tokens.accessToken || !credentials.clientId) {
                return undefined;
            }
            this._client = new TibberData({
                tokens,
                // The redirect URI is only used when logging in.
                oauth: createOAuth(credentials.clientId, credentials.clientSecret, 'http://localhost'),
                onTokensRefreshed: (newTokens) => {
                    saveTokens(RED, this.id, newTokens);
                    this._scheduleRefresh();
                },
                userAgent,
                apiUrl: getUrls(RED).apiUrl,
            });
            this._scheduleRefresh();
            return this._client;
        };

        /**
         * The access token to use right now: the configured access token, or the latest token from the login.
         */
        Object.defineProperty(this, 'currentAccessToken', {
            get: () => {
                if (this.authType !== 'oauth') {
                    return getCredentials().accessToken;
                }
                const client = this.getDataClient();
                return client && client.tokens ? client.tokens.accessToken : undefined;
            },
        });

        /**
         * Get a valid access token. A login token is refreshed first if it has expired.
         */
        this.getAccessToken = async (forceRefresh = false) => {
            if (this.authType !== 'oauth') {
                return getCredentials().accessToken;
            }
            const client = this.getDataClient();
            return client ? client.getAccessToken(forceRefresh) : undefined;
        };

        this._scheduleRefresh = () => {
            clearTimeout(this._refreshTimer);
            const expiresAt = this._client && this._client.tokens ? this._client.tokens.expiresAt : undefined;
            if (!expiresAt || this._closed) {
                return;
            }
            const delay = Math.max(expiresAt - Date.now() - REFRESH_MARGIN, REFRESH_MIN_DELAY);
            this._refreshTimer = setTimeout(async () => {
                try {
                    // A successful refresh schedules the next one through onTokensRefreshed.
                    await this._client.getAccessToken(true);
                } catch (error) {
                    const status = error && error.status;
                    if (status && status !== 429 && status < 500) {
                        this.error('Tibber rejected the login: ' + toError(error).message + '. Open the API endpoint and log in again.');
                        return;
                    }
                    this.warn('Unable to refresh the Tibber login: ' + toError(error).message);
                    this._refreshTimer = setTimeout(() => this._scheduleRefresh(), REFRESH_RETRY_DELAY);
                }
            }, delay);
        };

        this.on('close', (removed, done) => {
            this._closed = true;
            clearTimeout(this._refreshTimer);
            this._client = undefined;
            if (removed) {
                deleteTokens(RED, this.id);
            }
            done();
        });

        // Start keeping the login token fresh.
        this.getDataClient();
    }
    RED.nodes.registerType('tibber-api-endpoint', TibberApiEndpointNode, {
        credentials: {
            accessToken: { type: 'password' },
            clientId: { type: 'text' },
            clientSecret: { type: 'password' },
        },
    });

    // Logins that have been started from the editor, by OAuth state.
    const pending = new Map();

    // Finish a login with the values Tibber added to the redirect address. Returns the id of the endpoint.
    async function completeLogin(query, expectedId) {
        const login = pending.get(query.state);
        if (!login || Date.now() - login.created > PENDING_TIMEOUT || (expectedId && login.id !== expectedId)) {
            throw new Error('unknown or expired login. Start again from the Node-RED editor.');
        }
        pending.delete(query.state);
        if (!query.code) {
            throw new Error(query.error_description || query.error || 'No code received from Tibber');
        }
        saveTokens(RED, login.id, await login.oauth.exchangeCode(query.code, login.codeVerifier));
        const node = RED.nodes.getNode(login.id);
        if (node) {
            // Use the new tokens from now on.
            node._client = undefined;
            node.getDataClient();
        }
        return login.id;
    }

    // Start a login. Returns the URL the user must open to log in to Tibber.
    RED.httpAdmin.post('/tibber-api/:id/auth', RED.auth.needsPermission('tibber-api-endpoint.write'), (req, res) => {
        const body = req.body || {};
        const stored = RED.nodes.getCredentials(req.params.id) || {};
        const clientId = body.clientId || stored.clientId;
        // The editor sends a placeholder when the stored secret has not been changed.
        const clientSecret = body.clientSecret && body.clientSecret !== '__PWRD__' ? body.clientSecret : stored.clientSecret;
        let redirectUri;
        try {
            redirectUri = new URL(body.redirectUri).href;
        } catch {
            redirectUri = undefined;
        }
        if (!clientId || !redirectUri) {
            res.status(400).json({ error: 'Missing mandatory parameters (clientId and/or redirectUri)' });
            return;
        }

        const now = Date.now();
        for (const [state, login] of pending) {
            if (now - login.created > PENDING_TIMEOUT) pending.delete(state);
        }

        const oauth = createOAuth(clientId, clientSecret, redirectUri, body.scopes);
        const { url, state, codeVerifier } = oauth.createAuthorizationUrl();
        pending.set(state, { id: req.params.id, oauth, codeVerifier, created: now });
        res.json({ url });
    });

    // Tibber redirects the browser here after the login. The state identifies a login started above,
    // so the route needs no permission: the browser arrives from Tibber without the editor's session.
    const callback = async (req, res) => {
        try {
            await completeLogin(req.query || {});
            res.send('Logged in to Tibber. You can close this window and return to Node-RED.');
        } catch (error) {
            res.status(400).send(`Login failed: ${escapeHtml(toError(error).message)}`);
        }
    };
    RED.httpAdmin.get('/tibber-api/callback', callback);
    // The same address is served next to the HTTP In nodes, for installations where only those
    // are reachable through a public address and the editor is not.
    if (RED.httpNode) {
        RED.httpNode.get('/tibber-api/callback', callback);
    }

    // Finish a login from the address the browser ended up on, for when Tibber can not redirect to Node-RED.
    RED.httpAdmin.post('/tibber-api/:id/auth/complete', RED.auth.needsPermission('tibber-api-endpoint.write'), async (req, res) => {
        try {
            let query;
            try {
                query = Object.fromEntries(new URL(String((req.body || {}).url).trim()).searchParams);
            } catch {
                throw new Error('paste the whole address from the browser, starting with http.');
            }
            await completeLogin(query, req.params.id);
            res.json({ authorized: true });
        } catch (error) {
            res.status(400).json({ error: 'Login failed: ' + toError(error).message });
        }
    });

    // Tells the editor whether the user has logged in.
    RED.httpAdmin.get('/tibber-api/:id/status', RED.auth.needsPermission('tibber-api-endpoint.read'), (req, res) => {
        const tokens = loadTokens(RED, req.params.id);
        res.json({ authorized: !!(tokens && tokens.accessToken) });
    });
};
