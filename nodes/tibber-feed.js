const TibberFeed = require('tibber-api').TibberFeed;
const TibberQuery = require('tibber-api').TibberQuery;
const { getApiConfig, getTimeout, toError, getPayload } = require('./tibber-common');
const StatusEnum = Object.freeze({ 'unknown': -1, 'disconnected': 0, 'waiting': 1, 'connecting': 2, 'unauthenticated': 3, 'connected': 100 });

// A login token that is rejected is replaced and the feed reconnected, but not more often than this.
const TOKEN_RECOVERY_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Defensive helper
function getFeedNodeRegistry(feed) {
    if (!feed) return new Set();
    if (!feed._nodeRegistry) feed._nodeRegistry = new Set();
    return feed._nodeRegistry;
}

module.exports = function (RED) {
    function TibberFeedNode(config) {
        RED.nodes.createNode(this, config);
        const _config = config;
        this._config = _config;

        this.log('TibberFeedNode created');

        this._connectionDelay = -1;
        this._lastStatus = StatusEnum.unknown;
        this._setStatus = status => {
            if (status !== this._lastStatus) {
                this.log(`Status changed: ${this._lastStatus} -> ${status}`);
                switch (status) {
                    case StatusEnum.unknown:
                        this.status({ fill: "grey", shape: "ring", text: "unknown" });
                        break;
                    case StatusEnum.disconnected:
                        this.status({ fill: "red", shape: "ring", text: "disconnected" });
                        break;
                    case StatusEnum.waiting:
                        this.status({ fill: "yellow", shape: "ring", text: "waiting" });
                        break;
                    case StatusEnum.connecting:
                        this.status({ fill: "green", shape: "ring", text: "connecting" });
                        break;
                    case StatusEnum.unauthenticated:
                        this.status({ fill: "red", shape: "dot", text: "invalid token" });
                        break;
                    case StatusEnum.connected:
                        this.status({ fill: "green", shape: "dot", text: "connected" });
                        break;
                    default:
                        break;
                }
                this._lastStatus = status;
            }
        };

        this._setStatus(StatusEnum.disconnected);

        this._mapAndsend = (msg) => {
            const returnMsg = { payload: {} };
            if (msg && msg.payload)
                for (const property in msg.payload) {
                    if (_config[property])
                        returnMsg.payload[property] = msg.payload[property];
                }
            this.send(returnMsg);
        }

        this.connect = () => {
            this._setStatus(StatusEnum.connecting);
            this.debug('Calling _feed.connect()');
            try {
                this._feed.connect();
                this.debug('Called _feed.connect() successfully');
            } catch (err) {
                this.error('Error calling _feed.connect(): ' + err.message);
            }
        };

        // Event handlers for a feed. They are registered once per feed and pass the events on
        // to all nodes that share the feed, so they must not depend on the node that created them.
        const createFeedHandlers = (feed, endpoint) => {
            const forEachNode = callback => {
                for (const node of getFeedNodeRegistry(feed)) callback(node);
            };
            const logAndSetStatus = (status, text) => data => forEachNode(node => {
                node._setStatus(status);
                node.log(`${text}: ${JSON.stringify(data)}`);
            });
            let lastTokenRecovery = 0;

            return {
                connecting: logAndSetStatus(StatusEnum.connecting, 'Connecting'),
                connection_timeout: logAndSetStatus(StatusEnum.waiting, 'Connection Timeout'),
                connected: logAndSetStatus(StatusEnum.connected, 'Connected'),
                connection_ack: logAndSetStatus(StatusEnum.connected, 'Connected'),
                heartbeat_timeout: logAndSetStatus(StatusEnum.waiting, 'Heartbeat Timeout'),
                heartbeat_reconnect: logAndSetStatus(StatusEnum.connecting, 'Heartbeat Reconnect'),
                data: data => forEachNode(node => {
                    if (node._config && node._config.active && feed.connected) {
                        if (node._lastStatus !== StatusEnum.connected)
                            node._setStatus(StatusEnum.connected);
                        node._mapAndsend({ payload: data });
                    } else if (node._setStatus) {
                        node._setStatus(StatusEnum.disconnected);
                    }
                }),
                // The feed reconnects by itself, with the backoff Tibber requires.
                disconnected: data => forEachNode(node => {
                    if (node._lastStatus !== StatusEnum.unauthenticated)
                        node._setStatus(StatusEnum.disconnected);
                    node.log(`Disconnected: ${JSON.stringify(data)}`);
                }),
                error: data => {
                    const message = toError(data).message;
                    const unauthenticated = message.startsWith('Unauthenticated');
                    // The feed stops when the token is rejected. A login token may just have expired,
                    // so get a new one and connect again. An access token must be replaced by the user.
                    if (unauthenticated && endpoint && endpoint.authType === 'oauth' && Date.now() - lastTokenRecovery > TOKEN_RECOVERY_INTERVAL) {
                        lastTokenRecovery = Date.now();
                        forEachNode(node => node.warn('Tibber rejected the login token. Refreshing it and reconnecting.'));
                        endpoint.getAccessToken(true).then(
                            () => { if (feed.active) feed.connect(); },
                            error => forEachNode(node => {
                                node._setStatus(StatusEnum.unauthenticated);
                                node.error('TibberFeed error: ' + toError(error).message);
                            }),
                        );
                        return;
                    }
                    forEachNode(node => {
                        if (unauthenticated)
                            node._setStatus(StatusEnum.unauthenticated);
                        node.error('TibberFeed error: ' + message);
                    });
                },
                warn: data => forEachNode(node => node.warn(data)),
                log: data => forEachNode(node => node.log(data)),
            };
        };

        // Set up (or reuse) the shared TibberFeed for the given home id, and register this node with it.
        // The feed uses the token of the API endpoint, unless a token has been injected through an incoming message.
        this._setupFeed = (injectedToken, homeId) => {
            const apiConfig = getApiConfig(RED, _config, { accessToken: injectedToken, homeId });
            const endpoint = injectedToken ? undefined : RED.nodes.getNode(_config.apiEndpointRef);
            // A login token changes about once an hour, so feeds on an endpoint are identified by the endpoint.
            const key = injectedToken ? `token:${injectedToken}` : `endpoint:${_config.apiEndpointRef}`;
            const home = homeId;
            this._injectedToken = injectedToken;
            this._homeId = homeId;
            const feedTimeout = getTimeout(RED, _config, 'feedTimeout', 60);
            const feedConnectionTimeout = getTimeout(RED, _config, 'feedConnectionTimeout', 30);
            const queryRequestTimeout = getTimeout(RED, _config, 'queryRequestTimeout', 30);

            // Only one TibberFeed per key+home
            if (!TibberFeedNode.instances[key]) {
                TibberFeedNode.instances[key] = {};
            }
            if (!TibberFeedNode.instances[key][home]) {
                this.debug(`Creating new TibberFeed for home=${home}`);
                const feed = new TibberFeed(new TibberQuery(apiConfig, queryRequestTimeout), feedTimeout, true, feedConnectionTimeout, true);
                feed._registeredHandlers = createFeedHandlers(feed, endpoint);
                for (const eventName in feed._registeredHandlers) {
                    feed.on(eventName, feed._registeredHandlers[eventName]);
                }
                TibberFeedNode.instances[key][home] = feed;
            } else {
                this.log(`Reusing existing TibberFeed for home=${home}`);
            }
            this._feed = TibberFeedNode.instances[key][home];
            this._feedKey = key;

            // Register this node instance in the feed's registry
            const nodeRegistry = getFeedNodeRegistry(this._feed);
            nodeRegistry.add(this);
            this.debug(`Node registered. Registry size: ${nodeRegistry.size}`);

            // Only connect if this is the first node for this feed
            if (nodeRegistry.size === 1) {
                this._setStatus(StatusEnum.waiting);
                this.log('Preparing to connect to Tibber...');
                this._connectionDelay = setTimeout(() => {
                    this.connect();
                }, 1000);
            } else {
                this.log('Feed already connected or connecting.');
            }
        };

        // Unregister this node from its current feed and close the feed
        // if no other nodes are using it.
        this._teardownFeed = () => {
            clearTimeout(this._connectionDelay);
            if (!this._feed) return;

            // Remove this node from the registry
            const nodeRegistry = getFeedNodeRegistry(this._feed);
            nodeRegistry.delete(this);
            this.log(`Node unregistered. Registry size: ${nodeRegistry.size}`);

            // If no more nodes are using this feed, clean up
            if (nodeRegistry.size === 0) {
                this.log('Disconnecting from Tibber feed...');
                // Deactivating closes the feed and keeps it from reconnecting.
                this._feed.active = false;
                for (const eventName in this._feed._registeredHandlers) {
                    this._feed.off(eventName, this._feed._registeredHandlers[eventName]);
                }
                this._feed._registeredHandlers = null;
                const instances = TibberFeedNode.instances[this._feedKey];
                if (instances) {
                    delete instances[this._homeId];
                    if (Object.keys(instances).length === 0) delete TibberFeedNode.instances[this._feedKey];
                }
            }

            this._feed = null;
            this._setStatus(StatusEnum.disconnected);
        };

        // Accept a new access token and/or home id from an incoming message and
        // reconnect the feed with the new values. This makes it possible to control
        // the feed without reconfiguring the node (e.g. from a dashboard).
        this.on('input', (msg, send, done) => {
            const payload = getPayload(msg);
            const injectedToken = payload.accessToken || this._injectedToken;
            // Fall back to the configured home id when the feed has not been set up yet.
            const homeId = payload.homeId || this._homeId || _config.homeId;

            if (!payload.accessToken && !payload.homeId) {
                done('Nothing to do. Send msg.payload.accessToken and/or msg.payload.homeId to (re)configure the feed.');
                return;
            }
            if (!RED.nodes.getNode(_config.apiEndpointRef)?.queryUrl) {
                done('Missing API endpoint configuration (queryUrl).');
                return;
            }
            if (!homeId || !getApiConfig(RED, _config, { accessToken: injectedToken, homeId })) {
                done('Missing mandatory parameters (accessToken and/or homeId).');
                return;
            }
            if (injectedToken === this._injectedToken && homeId === this._homeId && this._feed) {
                this.log('Access token and home id unchanged. Skipping reconnect.');
                done();
                return;
            }

            this.log('New credentials received. Reconnecting feed...');
            this._teardownFeed();
            if (_config.active) {
                this._setupFeed(injectedToken, homeId);
            } else {
                this.log('Node is not active, skipping initialization.');
            }
            done();
        });

        this.on('close', (removed, done) => {
            if (!this._feed) {
                clearTimeout(this._connectionDelay);
                done();
                return;
            }
            this._teardownFeed();
            this.log('Done.');
            done();
        });

        if (!getApiConfig(RED, _config) || !_config.homeId) {
            this.warn('Missing mandatory parameters (accessToken and/or homeId). Log in or enter an access token on the API endpoint, or inject them through an incoming message (msg.payload.accessToken / msg.payload.homeId).');
            return;
        }

        if (!_config.active) {
            this.log('Node is not active, skipping initialization.');
            return;
        }

        this._setupFeed(undefined, _config.homeId);
    }
    TibberFeedNode.instances = {};

    RED.nodes.registerType("tibber-feed", TibberFeedNode);
};
