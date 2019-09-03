const TibberFeed = require('./TibberFeed');

module.exports = function (RED) {
    function TibberFeedNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        if (!config.apiUrl || !config.apiToken || !config.homeId) {
            node.error('Missing mandatory parameters. Execution will halt. Please reconfigure and publish again.');
            return;
        }

        if (!TibberFeedNode.instances[config.apiToken])
            TibberFeedNode.instances[config.apiToken] = new TibberFeed(config);

        if (!config.active) {
            if (!TibberFeedNode.instances[config.apiToken])
                return;
            TibberFeedNode.instances[config.apiToken].close();
            TibberFeedNode.instances[config.apiToken] = null;
            return;
        }

        TibberFeedNode.instances[config.apiToken].on('data', function (data) {
            var msg = {
                payload: data
            };
            node.send(msg);
            TibberFeedNode.instances[config.apiToken].heartbeat();
        });

        TibberFeedNode.instances[config.apiToken].on('connected', function (data) {
            node.log(data);
        });

        TibberFeedNode.instances[config.apiToken].on('connection_ack', function (data) {
            node.log(data);
        });

        TibberFeedNode.instances[config.apiToken].on('disconnected', function (data) {
            node.log(data);
            TibberFeedNode.instances[config.apiToken].heartbeat();
        });

        TibberFeedNode.instances[config.apiToken].on('error', function (data) {
            node.error(data);
        });

        TibberFeedNode.instances[config.apiToken].on('warn', function (data) {
            node.warn(data);
        });

        TibberFeedNode.instances[config.apiToken].on('log', function (data) {
            node.log(data);
        });

        node.on('close', function () {
            if (!TibberFeedNode.instances[config.apiToken])
                return;
            TibberFeedNode.instances[config.apiToken].close();
            TibberFeedNode.instances[config.apiToken] = null;
        });

        TibberFeedNode.instances[config.apiToken].connect();
    }
    TibberFeedNode.instances = [];

    RED.nodes.registerType("tibber-feed", TibberFeedNode);
};