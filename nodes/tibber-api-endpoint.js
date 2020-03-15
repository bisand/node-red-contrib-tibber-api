module.exports = function(RED) {
    function TibberApiEndpointNode(config) {
        RED.nodes.createNode(this, config);
        this.feedUrl = config.feedUrl;
        this.queryUrl = config.queryUrl;
        this.apiKey = config.apiKey;

        console.log(this.credentials);
        console.log(config);

        if (this.credentials && !this.credentials.secureApiKey && config.apiKey) {
            RED.nodes.addCredentials(this.id, { secureApiKey: config.apiKey });
            this.apiKey = config.apiKey = '';
        } else {
            this.credentials.secureApiKey = 'Test 123';
        }
    }
    RED.nodes.registerType('tibber-api-endpoint', TibberApiEndpointNode, {
        credentials: {
            secureApiKey: { type: 'text', required: true },
        },
    });
};
