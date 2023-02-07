require ('global-agent/bootstrap');
const TibberQuery = require('tibber-api').TibberQuery;

module.exports = function (RED) {
    function TibberQueryNode(config) {
        RED.nodes.createNode(this, config);
        config.apiEndpoint = RED.nodes.getNode(config.apiEndpointRef);
        this._config = config;

        var credentials = RED.nodes.getCredentials(config.apiEndpointRef);
        if (!config.apiEndpoint.queryUrl || !credentials || !credentials.accessToken) {
            this.error('Missing mandatory parameters (queryUrl and/or accessToken)');
            return;
        }

        // Assign access token to api key to meintain compatibility. This will not cause the access token to be exported.
        config.apiEndpoint.apiKey = credentials.accessToken;
        this.client = new TibberQuery(config);

        this.on('input', async (msg) => {
            var message = msg;
            try {
                var payload = await this.client.query(message.payload);
                message.payload = payload;
                this.send(message);
            } catch (error) {
                this.error(error);
            }
        });

    }

    RED.nodes.registerType("tibber-query", TibberQueryNode);
};
