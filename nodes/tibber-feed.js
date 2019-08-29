const TibberFeed = require('./TibberFeed');

module.exports = function (RED) {
    function TibberFeedNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        if (!config.apiUrl || !config.apiToken || !config.homeId) {
            node.error('Missing mandatory parameters');
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
        });

        TibberFeedNode.tibberFeed[config.apiToken].events.on('connected', function (data) {
            node.log(data);
        });

        TibberFeedNode.tibberFeed[config.apiToken].events.on('connection_ack', function (data) {
            node.log(data);
        });

        TibberFeedNode.tibberFeed[config.apiToken].events.on('disconnected', function (data) {
            node.log(data);
        });

        TibberFeedNode.tibberFeed[config.apiToken].events.on('error', function (data) {
            node.error(data);
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