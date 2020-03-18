module.exports = function (RED) {
    function TibberApiEndpointNode(config) {
        RED.nodes.createNode(this, config);

        if (this.credentials && !this.credentials.accessToken && config.apiKey) {
            RED.nodes.addCredentials(this.id, { accessToken: config.apiKey });
        }

        delete config.apiKey;
        delete this.apiKey;
        
        this.feedUrl = config.feedUrl;
        this.queryUrl = config.queryUrl;

        console.log(config);
        console.log(this.credentials);
    }
    RED.nodes.registerType('tibber-api-endpoint', TibberApiEndpointNode, {
        credentials: {
            accessToken: {
                type: 'text',
            },
        },
    });
};
