const TibberQuery = require('./TibberQuery');

module.exports = function (RED) {
    function TibberNotifyNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node._config = config;

        if (!config.apiUrl || !config.apiToken) {
            node.error('Missing mandatory parameters');
            return;
        }

        node.client = new TibberQuery(config);

        node.on('input', async function(msg) {
            var payload = await node.client.query(msg.payload);
            msg.payload = payload;
        });
 
    }

    RED.nodes.registerType("tibber-notify", TibberNotifyNode);
};
