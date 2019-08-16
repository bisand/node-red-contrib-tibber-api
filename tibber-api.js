var TibberFeed = require('./TibberFeed');

module.exports = function (RED) {
    function tibberApiNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        if( !config.apiUrl || !config.apikey || !config.homeid){
            node.error('Missing mandatory parameters');
            return;
        }
        var tibberFeed = new TibberFeed(config)
        tibberFeed.events.on('data', function (data) {
            var msg = { payload: data };
            node.send(msg);
        });

        tibberFeed.events.on('connected', function (data) {
            node.log(data);
        });

        tibberFeed.events.on('connection_ack', function (data) {
            node.log(JSON.stringify(data));
        });

        tibberFeed.events.on('disconnected', function (data) {
            node.log(data);
        });

        tibberFeed.events.on('error', function (data) {
            node.error(data);
        });

        node.on('close', function () {
            tibberFeed.close();
            tibberFeed = null;
        });
    }
    RED.nodes.registerType("tibber-feed", tibberApiNode);
}
