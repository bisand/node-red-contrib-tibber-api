const TibberFeed = require('./TibberFeed');

module.exports = function (RED) {
    function TibberFeedNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        if (!config.apiUrl || !config.apikey || !config.homeid) {
            node.error('Missing mandatory parameters');
            return;
        }

        if (!TibberFeedNode.tibberFeed[config.apikey])
            TibberFeedNode.tibberFeed[config.apikey] = new TibberFeed(config);

        if (!config.active) {
            TibberFeedNode.tibberFeed[config.apikey].close();
            TibberFeedNode.tibberFeed[config.apikey] = null;
            return;
        }

        TibberFeedNode.tibberFeed[config.apikey].events.on('data', function (data) {
            var msg = {
                payload: data
            };
            node.send(msg);
        });

        TibberFeedNode.tibberFeed[config.apikey].events.on('connected', function (data) {
            node.log(data);
        });

        TibberFeedNode.tibberFeed[config.apikey].events.on('connection_ack', function (data) {
            node.log(JSON.stringify(data));
        });

        TibberFeedNode.tibberFeed[config.apikey].events.on('disconnected', function (data) {
            node.log(data);
        });

        TibberFeedNode.tibberFeed[config.apikey].events.on('error', function (data) {
            node.error(data);
        });

        node.on('close', function () {
            if (!TibberFeedNode.tibberFeed[config.apikey])
                return;
            TibberFeedNode.tibberFeed[config.apikey].close();
            TibberFeedNode.tibberFeed[config.apikey] = null;
        });
    }
    TibberFeedNode.tibberFeed = [];

    RED.nodes.registerType("tibber-feed", TibberFeedNode);
};