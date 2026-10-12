const TibberFeed = require('tibber-api').TibberFeed;
const TibberQuery = require('tibber-api').TibberQuery;
const { getApiConfig, getTimeout, toError, getPayload } = require('./tibber-common');
const StatusEnum = Object.freeze({ 'unknown': -1, 'disconnected': 0, 'waiting': 1, 'connecting': 2, 'unauthenticated': 3, 'connected': 100 });

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

        this._onConnecting = data => {
            for (const node of getFeedNodeRegistry(this._feed)) {
                node._setStatus(StatusEnum.connecting);
                node.log(`Connecting: ${JSON.stringify(data)}`);
            }
        }
        this._onConnectionTimeout = data => {
            for (const node of getFeedNodeRegistry(this._feed)) {
                node._setStatus(StatusEnum.waiting);
                node.log(`Connection Timeout: ${JSON.stringify(data)}`);
            }
        }
        this._onConnected = data => {
            for (const node of getFeedNodeRegistry(this._feed)) {
                node._setStatus(StatusEnum.connected);
                node.log(`Connected: ${JSON.stringify(data)}`);
            }
        }
        this._onConnectionAck = data => {
            for (const node of getFeedNodeRegistry(this._feed)) {
                node._setStatus(StatusEnum.connected);
                node.log(`Connected: ${JSON.stringify(data)}`);
            }
        }
        this._onData = data => {
            for (const node of getFeedNodeRegistry(this._feed)) {
                if (node && node._config && node._config.active && node._feed && node._feed.connected) {
                    if (node._lastStatus !== StatusEnum.connected)
                        node._setStatus(StatusEnum.connected);
                    node._mapAndsend({ payload: data });
                } else if (node && node._setStatus) {
                    node._setStatus(StatusEnum.disconnected);
                }
            }
        }
        this._onHeartbeatTimeout = data => {
            for (const node of getFeedNodeRegistry(this._feed)) {
                node._setStatus(StatusEnum.waiting);
                node.log(`Heartbeat Timeout: ${JSON.stringify(data)}`);
            }
        }
        this._onHeartbeatReconnect = data => {
            for (const node of getFeedNodeRegistry(this._feed)) {
                node._setStatus(StatusEnum.connecting);
                node.log(`Heartbeat Reconnect: ${JSON.stringify(data)}`);
            }
        }

        // The feed reconnects by itself, with the backoff Tibber requires.
        this._onDisconnected = data => {
            for (const node of getFeedNodeRegistry(this._feed)) {
                if (node._lastStatus !== StatusEnum.unauthenticated)
                    node._setStatus(StatusEnum.disconnected);
                node.log(`Disconnected: ${JSON.stringify(data)}`);
            }
        }

        this._onError = data => {
            const message = toError(data).message;
            for (const node of getFeedNodeRegistry(this._feed)) {
                // The feed stops when the token is rejected. A new token can be injected through a message.
                if (message.startsWith('Unauthenticated'))
                    node._setStatus(StatusEnum.unauthenticated);
                node.error('TibberFeed error: ' + message);
            }
        }
        this._onWarn = data => {
            for (const node of getFeedNodeRegistry(this._feed)) {
                node.warn(data);
            }
        }
        this._onLog = data => {
            for (const node of getFeedNodeRegistry(this._feed)) {
                node.log(data);
            }
        }

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

        // Set up (or reuse) the shared TibberFeed for the given access token and home id,
        // and register this node with it. Used both at deploy time and when new
        // credentials are injected through an incoming message.
        this._setupFeed = (accessToken, homeId) => {
            const apiConfig = getApiConfig(RED, _config, { accessToken, homeId });
            const key = accessToken;
            const home = homeId;
            this._accessToken = accessToken;
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
                TibberFeedNode.instances[key][home] = new TibberFeed(new TibberQuery(apiConfig, queryRequestTimeout), feedTimeout, true, feedConnectionTimeout, true);
            } else {
                this.log(`Reusing existing TibberFeed for home=${home}`);
            }
            this._feed = TibberFeedNode.instances[key][home];
            this._feedKey = key;

            // Register this node instance in the feed's registry
            const nodeRegistry = getFeedNodeRegistry(this._feed);
            nodeRegistry.add(this);
            this.debug(`Node registered. Registry size: ${nodeRegistry.size}`);

            // Only add event listeners once per feed instance. Keep a reference to the
            // registered handlers on the feed so any node can unregister them later.
            if (!this._feed._eventHandlersRegistered) {
                this.debug('Registering event handlers for TibberFeed');
                this._feed._registeredHandlers = {
                    connecting: this._onConnecting,
                    connection_timeout: this._onConnectionTimeout,
                    connected: this._onConnected,
                    connection_ack: this._onConnectionAck,
                    data: this._onData,
                    heartbeat_timeout: this._onHeartbeatTimeout,
                    heartbeat_reconnect: this._onHeartbeatReconnect,
                    disconnected: this._onDisconnected,
                    error: this._onError,
                    warn: this._onWarn,
                    log: this._onLog,
                };
                for (const eventName in this._feed._registeredHandlers) {
                    this._feed.on(eventName, this._feed._registeredHandlers[eventName]);
                }
                this._feed._eventHandlersRegistered = true;
            }

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
                nodeRegistry.clear();
                const instances = TibberFeedNode.instances[this._feedKey];
                if (instances) {
                    delete instances[this._homeId];
                    if (Object.keys(instances).length === 0) delete TibberFeedNode.instances[this._feedKey];
                }

                if (typeof this._feed.off === 'function' && this._feed._eventHandlersRegistered && this._feed._registeredHandlers) {
                    this.debug('Unregistering event handlers for TibberFeed');
                    for (const eventName in this._feed._registeredHandlers) {
                        this._feed.off(eventName, this._feed._registeredHandlers[eventName]);
                    }
                    this._feed._registeredHandlers = null;
                }
                this._feed._eventHandlersRegistered = false;
            }

            this._feed = null;
            this._setStatus(StatusEnum.disconnected);
        };

        // Accept a new access token and/or home id from an incoming message and
        // reconnect the feed with the new values. This makes it possible to control
        // the feed without reconfiguring the node (e.g. from a dashboard).
        this.on('input', (msg, send, done) => {
            const payload = getPayload(msg);
            // Fall back to the configured values when the feed has not been set up yet.
            const configured = RED.nodes.getCredentials(_config.apiEndpointRef);
            const accessToken = payload.accessToken || this._accessToken || (configured && configured.accessToken);
            const homeId = payload.homeId || this._homeId || _config.homeId;

            if (!payload.accessToken && !payload.homeId) {
                done('Nothing to do. Send msg.payload.accessToken and/or msg.payload.homeId to (re)configure the feed.');
                return;
            }
            if (!accessToken || !homeId) {
                done('Missing mandatory parameters (accessToken and/or homeId).');
                return;
            }
            if (!getApiConfig(RED, _config, { accessToken, homeId })) {
                done('Missing API endpoint configuration (queryUrl).');
                return;
            }
            if (accessToken === this._accessToken && homeId === this._homeId && this._feed) {
                this.log('Access token and home id unchanged. Skipping reconnect.');
                done();
                return;
            }

            this.log('New credentials received. Reconnecting feed...');
            this._teardownFeed();
            if (_config.active) {
                this._setupFeed(accessToken, homeId);
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

        const credentials = RED.nodes.getCredentials(_config.apiEndpointRef);
        if (!getApiConfig(RED, _config) || !_config.homeId) {
            this.warn('Missing mandatory parameters (accessToken and/or homeId). Waiting for them to be injected through an incoming message (msg.payload.accessToken / msg.payload.homeId).');
            return;
        }

        if (!_config.active) {
            this.log('Node is not active, skipping initialization.');
            return;
        }

        this._setupFeed(credentials.accessToken, _config.homeId);
    }
    TibberFeedNode.instances = {};

    RED.nodes.registerType("tibber-feed", TibberFeedNode);
};
