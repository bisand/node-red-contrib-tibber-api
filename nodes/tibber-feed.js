const TibberFeed = require('tibber-api').TibberFeed;
const StatusEnum = Object.freeze({ 'unknown': -1, 'disconnected': 0, 'connected': 1 });

module.exports = function (RED) {
    function TibberFeedNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        const _config = config;
        _config.apiEndpoint = RED.nodes.getNode(_config.apiEndpointRef);

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

        if (!TibberFeedNode.instances[key]) {
            TibberFeedNode.instances[key] = {};
        }
        if (!TibberFeedNode.instances[key][home]) {
            TibberFeedNode.instances[key][home] = new TibberFeed(_config, 30000, true);
        }
        node._feed = TibberFeedNode.instances[key][home];

        node.listeners = {};
        node.listeners.onDataReceived = function onDataReceived(data) {
            var msg = {
                payload: data
            };
            if (_config.active && node._feed.connected) {
                node._setStatus(StatusEnum.connected);
                node._mapAndsend(msg);
                node._feed.heartbeat();
            } else {
                node._setStatus(StatusEnum.disconnected);
            }
        };
        node.listeners.onConnected = function onConnected(data) {
            node._setStatus(StatusEnum.connected);
            node.log(data);
        };
        node.listeners.onDisconnected = function onDisconnected(data) {
            node._setStatus(StatusEnum.disconnected);
            node.log(data);
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
            node._setStatus(StatusEnum.disconnected);
            if (!node._feed)
                return;
            node._feed.off('data', node.listeners.onDataReceived);
            node._feed.off('connected', node.listeners.onConnected);
            node._feed.off('connection_ack', node.listeners.onConnected);
            node._feed.off('disconnected', node.listeners.onDisconnected);
            node._feed.off('error', node.listeners.onError);
            node._feed.off('warn', node.listeners.onWarn);
            node._feed.off('log', node.listeners.onLog);
            node._feed = null;
            node.listeners = null;
            if (removed) {
                // This node has been disabled/deleted
            } else {
                // This node is being restarted
            }
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

        if (!node._feed.connected) {
            node._feed.connect();
        }

    }
    TibberFeedNode.instances = {};

    RED.nodes.registerType("tibber-feed", TibberFeedNode);
};