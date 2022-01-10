const TibberFeed = require('tibber-api').TibberFeed;
const StatusEnum = Object.freeze({ 'unknown': -1, 'disconnected': 0, 'waiting': 1, 'connecting': 2, 'connected': 100 });

module.exports = function (RED) {
    function TibberFeedNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        const _config = config;
        _config.apiEndpoint = RED.nodes.getNode(_config.apiEndpointRef);

        node._connectionDelay = -1;
        node._lastStatus = StatusEnum.unknown;
        node._setStatus = status => {
            if (status !== node._lastStatus) {
                switch (status) {
                    case StatusEnum.unknown:
                        node.status({ fill: "grey", shape: "ring", text: "unknown" });
                        break;
                    case StatusEnum.disconnected:
                        node.status({ fill: "red", shape: "ring", text: "disconnected" });
                        break;
                    case StatusEnum.waiting:
                        node.status({ fill: "yellow", shape: "ring", text: "waiting" });
                        break;
                    case StatusEnum.connecting:
                        node.status({ fill: "green", shape: "ring", text: "connecting" });
                        break;
                    case StatusEnum.connected:
                        node.status({ fill: "green", shape: "dot", text: "connected" });
                        break;

                    default:
                        break;
                }
                node._lastStatus = status;
            }
        };
        node._setStatus(StatusEnum.disconnected);

        const credentials = RED.nodes.getCredentials(_config.apiEndpointRef);
        if (!_config.apiEndpoint.feedUrl || !credentials || !credentials.accessToken || !_config.homeId) {
            node.error('Missing mandatory parameters. Execution will halt. Please reconfigure and publish again.');
            return;
        }

        if (!_config.active) {
            return;
        }

        // Assign access token to api key to meintain compatibility. This will not cause the access token to be exported.
        const key = _config.apiEndpoint.apiKey = credentials.accessToken;
        const home = _config.homeId;
        const feedTimeout = (_config.apiEndpoint.feedTimeout ? _config.apiEndpoint.feedTimeout : 60) * 1000;

        if (!TibberFeedNode.instances[key]) {
            TibberFeedNode.instances[key] = {};
        }
        if (!TibberFeedNode.instances[key][home]) {
            TibberFeedNode.instances[key][home] = new TibberFeed(_config, feedTimeout, true);
        }
        node._feed = TibberFeedNode.instances[key][home];
        if (!node._feed.active) {
            node._feed.active = true;
        }
        if (!node._feed.refCount || node._feed.refCount < 1) {
            node._feed.refCount = 1;
        }
        else {
            node._feed.refCount++;
        }

        node.listeners = {};
        node.listeners.onDataReceived = function onDataReceived(data) {
            var msg = {
                payload: data
            };
            if (_config.active && node._feed.connected) {
                if (node._lastStatus !== StatusEnum.connected)
                    node._setStatus(StatusEnum.connected);
                node._mapAndsend(msg);
                node._feed.heartbeat();
            } else {
                node._setStatus(StatusEnum.disconnected);
            }
        };
        node.listeners.onConnected = function onConnected(data) {
            node._setStatus(StatusEnum.connected);
            node.log(JSON.stringify(data));
            node._feed.heartbeat();
        };
        node.listeners.onDisconnected = function onDisconnected(data) {
            if (node._lastStatus !== StatusEnum.waiting && node._lastStatus !== StatusEnum.connecting)
                node._setStatus(StatusEnum.disconnected);
            node.log(JSON.stringify(data));
            node._feed.heartbeat();
        };
        node.listeners.onError = function onError(data) {
            node.error(data);
        };
        node.listeners.onWarn = function onWarn(data) {
            node.warn(data);
        };
        node.listeners.onLog = function onLog(data) {
            node.log(data);
        };

        if (_config.active) {
            node._feed.on('data', node.listeners.onDataReceived);
            node._feed.on('connected', node.listeners.onConnected);
            node._feed.on('connection_ack', node.listeners.onConnected);
            node._feed.on('disconnected', node.listeners.onDisconnected);
            node._feed.on('error', node.listeners.onError);
            node._feed.on('warn', node.listeners.onWarn);
            node._feed.on('log', node.listeners.onLog);
        }

        node.on('close', function (removed, done) {
            clearTimeout(node._connectionDelay)
            if (!node._feed) {
                done();
                return;
            }

            node._feed.refCount--;
            if (removed) {
                // This node is being removed
            } else {
                // This node is being restarted
            }

            node.log('Unregistering event handlers...');
            node._feed.off('data', node.listeners.onDataReceived);
            node._feed.off('connected', node.listeners.onConnected);
            node._feed.off('connection_ack', node.listeners.onConnected);
            node._feed.off('disconnected', node.listeners.onDisconnected);
            node._feed.off('error', node.listeners.onError);
            node._feed.off('warn', node.listeners.onWarn);
            node._feed.off('log', node.listeners.onLog);
            node.listeners = null;

            if (node._feed && node._feed.refCount < 1) {
                node.log('Disconnecting from Tibber feed...');
                node._feed.active = false;
                node._feed.close();
            }
            node._feed = null;

            node._setStatus(StatusEnum.disconnected);
            node.log('Done.');
            done();
        });

        node._mapAndsend = (msg) => {
            const returnMsg = { payload: {} };
            if (msg && msg.payload)
                for (const property in msg.payload) {
                    if (_config[property])
                        returnMsg.payload[property] = msg.payload[property];
                }
            node.send(returnMsg);
        }

        node.connect = () => {
            node._setStatus(StatusEnum.connecting);
            node.log('Connecting to Tibber...');
            node._feed.connect();
        };

        if (node._feed && !node._feed.connected && node._feed.refCount === 1) {
            node._setStatus(StatusEnum.waiting);
            node.log('Preparing to connect to Tibber...');
            node._connectionDelay = setTimeout(() => {
                node.connect();
            }, 1000);
        }
    }
    TibberFeedNode.instances = {};

    RED.nodes.registerType("tibber-feed", TibberFeedNode);
};