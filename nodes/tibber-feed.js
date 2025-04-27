const TibberFeed = require('tibber-api').TibberFeed;
const TibberQuery = require('tibber-api').TibberQuery;
const StatusEnum = Object.freeze({ 'unknown': -1, 'disconnected': 0, 'waiting': 1, 'connecting': 2, 'connected': 100 });

// Add this helper to manage node instances per feed
function getFeedNodeRegistry(feed) {
    if (!feed._nodeRegistry) {
        feed._nodeRegistry = new Set();
    }
    return feed._nodeRegistry;
}

module.exports = function (RED) {
    function TibberFeedNode(config) {
        RED.nodes.createNode(this, config);
        const _config = config;
        _config.apiEndpoint = RED.nodes.getNode(_config.apiEndpointRef);

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

        const credentials = RED.nodes.getCredentials(_config.apiEndpointRef);
        if (!_config.apiEndpoint.queryUrl || !credentials || !credentials.accessToken || !_config.homeId) {
            this.error('Missing mandatory parameters. Execution will halt. Please reconfigure and publish again.');
            return;
        }

        if (!_config.active) {
            this.log('Node is not active, skipping initialization.');
            return;
        }

        // Assign access token to api key to maintain compatibility.
        const key = _config.apiEndpoint.apiKey = credentials.accessToken;
        const home = _config.homeId;
        const feedTimeout = (_config.apiEndpoint.feedTimeout ? _config.apiEndpoint.feedTimeout : 60) * 1000;
        const feedConnectionTimeout = (_config.apiEndpoint.feedConnectionTimeout ? _config.apiEndpoint.feedConnectionTimeout : 30) * 1000;
        const queryRequestTimeout = (_config.apiEndpoint.queryRequestTimeout ? _config.apiEndpoint.queryRequestTimeout : 30) * 1000;

        // Only one TibberFeed per key+home
        if (!TibberFeedNode.instances[key]) {
            TibberFeedNode.instances[key] = {};
        }
        if (!TibberFeedNode.instances[key][home]) {
            this.log(`Creating new TibberFeed for key=${key}, home=${home}`);
            TibberFeedNode.instances[key][home] = new TibberFeed(new TibberQuery(_config), feedTimeout, true);
        } else {
            this.log(`Reusing existing TibberFeed for key=${key}, home=${home}`);
        }
        this._feed = TibberFeedNode.instances[key][home];
        this._feed.config = _config;
        this._feed.feedIdleTimeout = feedTimeout;
        this._feed.feedConnectionTimeout = feedConnectionTimeout;
        this._feed.queryRequestTimeout = queryRequestTimeout;

        // Register this node instance in the feed's registry
        const nodeRegistry = getFeedNodeRegistry(this._feed);
        nodeRegistry.add(this);
        this.log(`Node registered. Registry size: ${nodeRegistry.size}`);

        // Only add event listeners once per feed instance
        if (!this._feed._eventHandlersRegistered) {
            this.log('Registering event handlers for TibberFeed');
            this._feed.on('connecting', data => {
                for (const node of getFeedNodeRegistry(this._feed)) {
                    node._setStatus(StatusEnum.connecting);
                    node.log(`Connecting: ${JSON.stringify(data)}`);
                }
            });
            this._feed.on('connection_timeout', data => {
                for (const node of getFeedNodeRegistry(this._feed)) {
                    node._setStatus(StatusEnum.waiting);
                    node.log(`Connection Timeout: ${JSON.stringify(data)}`);
                }
            });
            this._feed.on('connected', data => {
                for (const node of getFeedNodeRegistry(this._feed)) {
                    node._setStatus(StatusEnum.connected);
                    node.log(`Connected: ${JSON.stringify(data)}`);
                }
            });
            this._feed.on('connection_ack', data => {
                for (const node of getFeedNodeRegistry(this._feed)) {
                    node._setStatus(StatusEnum.connected);
                    node.log(`Connected: ${JSON.stringify(data)}`);
                }
            });
            this._feed.on('data', data => {
                for (const node of getFeedNodeRegistry(this._feed)) {
                    if (node && node._config && node._config.active && node._feed && node._feed.connected) {
                        if (node._lastStatus !== StatusEnum.connected)
                            node._setStatus(StatusEnum.connected);
                        node._mapAndsend({ payload: data });
                    } else if (node && node._setStatus) {
                        node._setStatus(StatusEnum.disconnected);
                    }
                }
            });
            this._feed.on('heartbeat_timeout', data => {
                for (const node of getFeedNodeRegistry(this._feed)) {
                    node._setStatus(StatusEnum.waiting);
                    node.log(`Heartbeat Timeout: ${JSON.stringify(data)}`);
                }
            });
            this._feed.on('heartbeat_reconnect', data => {
                for (const node of getFeedNodeRegistry(this._feed)) {
                    node._setStatus(StatusEnum.connecting);
                    node.log(`Heartbeat Reconnect: ${JSON.stringify(data)}`);
                }
            });
            this._feed.on('disconnected', data => {
                for (const node of getFeedNodeRegistry(this._feed)) {
                    if (node._lastStatus !== StatusEnum.waiting && node._lastStatus !== StatusEnum.connecting)
                        node._setStatus(StatusEnum.disconnected);
                    node.log(`Disconnected: ${JSON.stringify(data)}`);
                }
            });
            this._feed.on('error', data => {
                for (const node of getFeedNodeRegistry(this._feed)) {
                    node.error(data);
                }
            });
            this._feed.on('warn', data => {
                for (const node of getFeedNodeRegistry(this._feed)) {
                    node.warn(data);
                }
            });
            this._feed.on('log', data => {
                for (const node of getFeedNodeRegistry(this._feed)) {
                    node.log(data);
                }
            });
            this._feed._eventHandlersRegistered = true;
        }

        this._mapAndsend = (msg) => {
            const returnMsg = { payload: {} };
            if (msg && msg.payload)
                for (const property in msg.payload) {
                    if (_config[property])
                        returnMsg.payload[property] = msg.payload[property];
                }
            this.log(`Sending message: ${JSON.stringify(returnMsg)}`);
            this.send(returnMsg);
        }

        this.connect = () => {
            this._setStatus(StatusEnum.connecting);
            this.log('Calling _feed.connect()');
            this._feed.connect();
        };

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

        this.on('close', (removed, done) => {
            clearTimeout(this._connectionDelay);
            if (!this._feed) {
                done();
                return;
            }

            // Remove this node from the registry
            nodeRegistry.delete(this);
            this.log(`Node unregistered. Registry size: ${nodeRegistry.size}`);

            // If no more nodes are using this feed, clean up
            if (nodeRegistry.size === 0) {
                this.log('Disconnecting from Tibber feed...');
                this._feed.close();
                delete this._feed._eventHandlersRegistered;
                delete this._feed._nodeRegistry;
            }

            this._feed = null;
            this._setStatus(StatusEnum.disconnected);
            this.log('Done.');
            done();
        });
    }
    TibberFeedNode.instances = {};

    RED.nodes.registerType("tibber-feed", TibberFeedNode);
};