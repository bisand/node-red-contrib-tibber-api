const { userAgent } = require('./tibber-common');

module.exports = function (RED) {
    function TibberApiEndpointNode(config) {
        RED.nodes.createNode(this, config);

        if (this.credentials && !this.credentials.accessToken && config.apiKey) {
            RED.nodes.addCredentials(this.id, { accessToken: config.apiKey });
        }

        // delete properties, just in case.
        delete config.apiKey;
        delete this.apiKey;

        this.queryUrl = config.queryUrl;
        this.feedTimeout = config.feedTimeout;
        this.feedConnectionTimeout = config.feedConnectionTimeout;
        this.queryRequestTimeout = config.queryRequestTimeout;
        this.userAgent = userAgent;
    }
    RED.nodes.registerType('tibber-api-endpoint', TibberApiEndpointNode, {
        credentials: {
            accessToken: {
                type: 'password',
            },
        },
    });
};
