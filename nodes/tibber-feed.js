const TibberFeed = require('./TibberFeed');

module.exports = function (RED) {
    function TibberFeedNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.status({ fill: "red", shape: "ring", text: "disconnected" });

        config.apiEndpoint = RED.nodes.getNode(config.apiEndpointRef);

        if (!config.apiEndpoint.feedUrl || !config.apiEndpoint.apiKey || !config.homeId) {
            node.error('Missing mandatory parameters. Execution will halt. Please reconfigure and publish again.');
            return;
        }

        if (!TibberFeedNode.instances[config.apiEndpoint.apiKey])
            TibberFeedNode.instances[config.apiEndpoint.apiKey] = new TibberFeed(config);

        if (!config.active) {
            if (!TibberFeedNode.instances[config.apiEndpoint.apiKey])
                return;
            TibberFeedNode.instances[config.apiEndpoint.apiKey].close();
            TibberFeedNode.instances[config.apiEndpoint.apiKey] = null;
            return;
        }

        TibberFeedNode.instances[config.apiEndpoint.apiKey].on('data', function (data) {
            var msg = {
                payload: data
            };
            node.send(msg);
            if (TibberFeedNode.instances[config.apiEndpoint.apiKey])
                TibberFeedNode.instances[config.apiEndpoint.apiKey].heartbeat();
        });

        TibberFeedNode.instances[config.apiEndpoint.apiKey].on('connected', function (data) {
            node.log(data);
        });

        TibberFeedNode.instances[config.apiEndpoint.apiKey].on('connection_ack', function (data) {
            node.status({ fill: "green", shape: "dot", text: "connected" });
            node.log(data);
        });

        TibberFeedNode.instances[config.apiEndpoint.apiKey].on('disconnected', function (data) {
            node.status({ fill: "red", shape: "ring", text: "disconnected" });
            node.log(data);
            if (TibberFeedNode.instances[config.apiEndpoint.apiKey])
                TibberFeedNode.instances[config.apiEndpoint.apiKey].heartbeat();
        });

        TibberFeedNode.instances[config.apiEndpoint.apiKey].on('error', function (data) {
            node.error(data);
        });

        TibberFeedNode.instances[config.apiEndpoint.apiKey].on('warn', function (data) {
            node.warn(data);
        });

        TibberFeedNode.instances[config.apiEndpoint.apiKey].on('log', function (data) {
            node.log(data);
        });

        node.on('close', function () {
            if (!TibberFeedNode.instances[config.apiEndpoint.apiKey])
                return;
            node.status({ fill: "red", shape: "ring", text: "disconnected" });
            TibberFeedNode.instances[config.apiEndpoint.apiKey].close();
            TibberFeedNode.instances[config.apiEndpoint.apiKey] = null;
        });

        TibberFeedNode.instances[config.apiEndpoint.apiKey].connect();
    }
    TibberFeedNode.instances = [];

    RED.nodes.registerType("tibber-feed", TibberFeedNode);
};