const TibberQuery = require('tibber-api').TibberQuery;

module.exports = function (RED) {
    function TibberQueryNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        config.apiEndpoint = RED.nodes.getNode(config.apiEndpointRef);
        node._config = config;

        var credentials = RED.nodes.getCredentials(config.apiEndpointRef);
        if (!config.apiEndpoint.queryUrl || !credentials || !credentials.accessToken) {
            node.error('Missing mandatory parameters (queryUrl and/or accessToken)');
            return;
        }

        // Assign access token to api key to meintain compatibility. This will not cause the access token to be exported.
        config.apiEndpoint.apiKey = credentials.accessToken;
        node.client = new TibberQuery(config);

        node.on('input', async function (msg) {
            var message = msg;
            try {
                var payload = await node.client.query(message.payload);
                message.payload = payload;
                node.send(message);
            } catch (error) {
                node.error(error);
            }
        });

    }

    RED.nodes.registerType("tibber-query", TibberQueryNode);
};
