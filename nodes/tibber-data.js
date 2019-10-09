const TibberQuery = require('tibber-api').TibberQuery;

module.exports = function(RED) {
    function TibberDataNode(config) {
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
            var queryName = node._config.queryName ? node._config.queryName : msg.payload.queryName;
            var homeId = node._config.homeId ? node._config.homeId : msg.payload.homeId;
            var energyResolution = node._config.energyResolution ? node._config.energyResolution : msg.payload.energyResolution;
            var lastCount = node._config.lastCount ? node._config.lastCount : msg.payload.lastCount;

            var payload = {};
            switch (queryName) {
                case 'getHome':
                    payload = await node.client.getHome(homeId);
                    break;
                case 'getHomes':
                    payload = await node.client.getHomes();
                    break;
                case 'getConsumption':
                    payload = await node.client.getConsumption(energyResolution, lastCount, homeId);
                    break;
                default:
                    break;
            }
            if (payload) {
                message.payload = payload;
                node.send(message);
            }
        });
    }

    RED.nodes.registerType('tibber-data', TibberDataNode);
};
