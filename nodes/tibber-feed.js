const TibberFeed = require('tibber-api').TibberFeed;
const TibberQuery = require('tibber-api').TibberQuery;
const StatusEnum = Object.freeze({ 'unknown': -1, 'disconnected': 0, 'waiting': 1, 'connecting': 2, 'connected': 100 });

module.exports = function (RED) {
    function TibberFeedNode(config) {
        RED.nodes.createNode(this, config);
        const _config = config;
        _config.apiEndpoint = RED.nodes.getNode(_config.apiEndpointRef);

        this._connectionDelay = -1;
        this._lastStatus = StatusEnum.unknown;
        this._setStatus = status => {
            if (status !== this._lastStatus) {
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
            return;
        }

        // Assign access token to api key to meintain compatibility. This will not cause the access token to be exported.
        const key = _config.apiEndpoint.apiKey = credentials.accessToken;
        const home = _config.homeId;
        const feedTimeout = (_config.apiEndpoint.feedTimeout ? _config.apiEndpoint.feedTimeout : 60) * 1000;
        const feedConnectionTimeout = (_config.apiEndpoint.feedConnectionTimeout ? _config.apiEndpoint.feedConnectionTimeout : 30) * 1000;
        const queryRequestTimeout = (_config.apiEndpoint.queryRequestTimeout ? _config.apiEndpoint.queryRequestTimeout : 30) * 1000;

        if (!TibberFeedNode.instances[key]) {
            TibberFeedNode.instances[key] = {};
        }
        if (!TibberFeedNode.instances[key][home]) {
            TibberFeedNode.instances[key][home] = new TibberFeed(new TibberQuery(_config), feedTimeout, true);
        }
        this._feed = TibberFeedNode.instances[key][home];
        this._feed.feedIdleTimeout = feedTimeout;
        this._feed.feedConnectionTimeout = feedConnectionTimeout;
        this._feed.queryRequestTimeout = queryRequestTimeout;
        if (!this._feed.refCount || this._feed.refCount < 1) {
            this._feed.refCount = 1;
        }
        else {
            this._feed.refCount++;
        }

        this.listeners = {};
        this.listeners.onDataReceived = (data) => {
            var msg = {
                payload: data
            };
            if (_config.active && this._feed.connected) {
                if (this._lastStatus !== StatusEnum.connected)
                    this._setStatus(StatusEnum.connected);
                this._mapAndsend(msg);
            } else {
                this._setStatus(StatusEnum.disconnected);
            }
        };
        this.listeners.onConnected = (data) => {
            this._setStatus(StatusEnum.connected);
            this.log(JSON.stringify(data));
        };
        this.listeners.onDisconnected = (data) => {
            if (this._lastStatus !== StatusEnum.waiting && this._lastStatus !== StatusEnum.connecting)
                this._setStatus(StatusEnum.disconnected);
            this.log(JSON.stringify(data));
        };
        this.listeners.onError = (data) => {
            this.error(data);
        };
        this.listeners.onWarn = (data) => {
            this.warn(data);
        };
        this.listeners.onLog = (data) => {
            this.log(data);
        };

        if (_config.active) {
            this._feed.on('data', this.listeners.onDataReceived);
            this._feed.on('connected', this.listeners.onConnected);
            this._feed.on('connection_ack', this.listeners.onConnected);
            this._feed.on('disconnected', this.listeners.onDisconnected);
            this._feed.on('error', this.listeners.onError);
            this._feed.on('warn', this.listeners.onWarn);
            this._feed.on('log', this.listeners.onLog);
        }

        this.on('close', (removed, done) => {
            clearTimeout(this._connectionDelay)
            if (!this._feed) {
                done();
                return;
            }

            this._feed.refCount--;
            if (removed) {
                // This node is being removed
            } else {
                // This node is being restarted
            }

            this.log('Unregistering event handlers...');
            this._feed.off('data', this.listeners.onDataReceived);
            this._feed.off('connected', this.listeners.onConnected);
            this._feed.off('connection_ack', this.listeners.onConnected);
            this._feed.off('disconnected', this.listeners.onDisconnected);
            this._feed.off('error', this.listeners.onError);
            this._feed.off('warn', this.listeners.onWarn);
            this._feed.off('log', this.listeners.onLog);
            this.listeners = null;

            if (this._feed && this._feed.refCount < 1) {
                this.log('Disconnecting from Tibber feed...');
                this._feed.close();
            }
            this._feed = null;

            this._setStatus(StatusEnum.disconnected);
            this.log('Done.');
            done();
        });

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
            this.log('Connecting to Tibber...');
            this._feed.connect();
        };

        if (this._feed && this._feed.refCount === 1) {
            this._setStatus(StatusEnum.waiting);
            this.log('Preparing to connect to Tibber...');
            this._connectionDelay = setTimeout(() => {
                this.connect();
            }, 1000);
        }
    }
    TibberFeedNode.instances = {};

    RED.nodes.registerType("tibber-feed", TibberFeedNode);
};