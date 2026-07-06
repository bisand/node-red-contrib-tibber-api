const TibberQuery = require('tibber-api').TibberQuery;

module.exports = function (RED) {
    function TibberUpdateHomeNode(config) {
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
            var payload = msg.payload && typeof msg.payload === 'object' ? msg.payload : {};
            var homeId = this._config.homeId ? this._config.homeId : payload.homeId;

            if (!homeId) {
                this.error('Missing mandatory parameter (homeId)', msg);
                return;
            }

            var input = { homeId: homeId };
            // Optional home properties. Values from the incoming message payload.
            ['appNickname', 'appAvatar', 'size', 'type', 'numberOfResidents', 'primaryHeatingSource', 'hasVentilationSystem', 'mainFuseSize'].forEach((prop) => {
                if (payload[prop] !== undefined) {
                    input[prop] = payload[prop];
                }
            });

            try {
                var result = await this.client.updateHome(input);
                if (result && (result.error || result.errors)) {
                    this.error(JSON.stringify(result), msg);
                } else {
                    message.payload = result;
                    this.send(message);
                }
            } catch (error) {
                this.error(error, msg);
            }
        });
    }

    RED.nodes.registerType('tibber-update-home', TibberUpdateHomeNode);
};
