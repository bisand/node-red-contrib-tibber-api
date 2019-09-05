const TibberQuery = require('./TibberQuery');

module.exports = function (RED) {
    function TibberQueryNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        config.apiEndpoint = RED.nodes.getNode(config.apiEndpointRef);
        node._config = config;

        if (!config.apiEndpoint.queryUrl || !config.apiEndpoint.apiKey) {
            node.error('Missing mandatory parameters (queryUrl and/or apiKey)');
            return;
        }

        node.client = new TibberQuery(config);

        node.on('input', async function(msg) {
            var message = msg;
            var payload = await node.client.query(message.payload);
            message.payload = payload;
            node.send(message);
        });
 
    }

    RED.nodes.registerType("tibber-query", TibberQueryNode);
};
