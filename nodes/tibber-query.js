const TibberQuery = require('./TibberQuery');

module.exports = function (RED) {
    function TibberQueryNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node._config = config;

        if (!config.apiUrl || !config.apiToken) {
            node.error('Missing mandatory parameters');
            return;
        }

        node.client = new TibberQuery(config);

        node.on('input', async function(msg) {
            msg.payload = await node.client.query(msg.payload);
            node.send(msg);
        });
 
    }

    RED.nodes.registerType("tibber-query", TibberQueryNode);
};
