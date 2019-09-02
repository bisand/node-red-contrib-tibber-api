const TibberFeed = require('./TibberFeed');

module.exports = function (RED) {
    function TibberFeedNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        if (!config.apiUrl || !config.apiToken || !config.homeId) {
            node.error('Missing mandatory parameters. Execution will halt. Please reconfigure and publish again.');
            return;
        }

        if (!TibberFeedNode.tibberFeed[config.apiToken])
            TibberFeedNode.tibberFeed[config.apiToken] = new TibberFeed(config);

        if (!config.active) {
            if (!TibberFeedNode.tibberFeed[config.apiToken])
                return;
            TibberFeedNode.tibberFeed[config.apiToken].close();
            TibberFeedNode.tibberFeed[config.apiToken] = null;
            return;
        }

        TibberFeedNode.tibberFeed[config.apiToken].events.on('data', function (data) {
            var msg = {
                payload: data
            };
            node.send(msg);
            node.heartbeat();
        });

        TibberFeedNode.tibberFeed[config.apiToken].events.on('connected', function (data) {
            node.log(data);
        });

        TibberFeedNode.tibberFeed[config.apiToken].events.on('connection_ack', function (data) {
            node.log(data);
        });

        TibberFeedNode.tibberFeed[config.apiToken].events.on('disconnected', function (data) {
            node.log(data);
            node.heartbeat();
        });

        TibberFeedNode.tibberFeed[config.apiToken].events.on('error', function (data) {
            node.error(data);
        });

        TibberFeedNode.tibberFeed[config.apiToken].events.on('warn', function (data) {
            node.warn(data);
        });

        TibberFeedNode.tibberFeed[config.apiToken].events.on('log', function (data) {
            node.log(data);
        });

        node.on('close', function () {
            if (!TibberFeedNode.tibberFeed[config.apiToken])
                return;
            TibberFeedNode.tibberFeed[config.apiToken].close();
            TibberFeedNode.tibberFeed[config.apiToken] = null;
        });

        TibberFeedNode.tibberFeed[config.apiToken].connect();
    }
    TibberFeedNode.tibberFeed = [];

    RED.nodes.registerType("tibber-feed", TibberFeedNode);
};