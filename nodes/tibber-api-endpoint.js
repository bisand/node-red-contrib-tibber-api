module.exports = function (RED) {
    function TibberApiEndpointNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        if (node.credentials && !node.credentials.accessToken && config.apiKey) {
            RED.nodes.addCredentials(node.id, { accessToken: config.apiKey });
        }

        // delete properties, just in case.
        delete config.apiKey;
        delete node.apiKey;

        node.feedUrl = config.feedUrl;
        node.queryUrl = config.queryUrl;

        node.on('export', () => {
            alert('EXPORT!');
        });
    }
    RED.nodes.registerType('tibber-api-endpoint', TibberApiEndpointNode, {
        credentials: {
            accessToken: {
                type: 'text',
            },
        },
    });
};
