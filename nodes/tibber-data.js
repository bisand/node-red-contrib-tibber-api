const TibberQuery = require('tibber-api').TibberQuery;

module.exports = function(RED) {
    function TibberDataNode(config) {
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

        node.on('input', async function(msg) {
            var message = msg;
            var queryName = node._config.queryName ? node._config.queryName : msg.payload.queryName;
            var homeId = node._config.homeId ? node._config.homeId : msg.payload.homeId;
            var energyResolution = node._config.energyResolution ? node._config.energyResolution : msg.payload.energyResolution;
            var lastCount = Number(node._config.lastCount ? node._config.lastCount : msg.payload.lastCount);

            // Preserve default values.
            energyResolution = energyResolution ? energyResolution : 'HOURLY';
            if (isNaN(lastCount)) {
                lastCount = 10;
            }

            var payload = {};
            switch (queryName) {
                case 'getHome':
                    try {
                        payload = await node.client.getHome(homeId);
                    } catch (error) {
                        payload = error;
                    }
                    break;
                case 'getHomeComplete':
                    try {
                        payload = await node.client.getHomeComplete(homeId);
                    } catch (error) {
                        payload = error;
                    }
                    break;
                case 'getHomes':
                    try {
                        payload = await node.client.getHomes();
                    } catch (error) {
                        payload = error;
                    }
                    break;
                case 'getHomesComplete':
                    try {
                        payload = await node.client.getHomesComplete();
                    } catch (error) {
                        payload = error;
                    }
                    break;
                case 'getCurrentEnergyPrice':
                    try {
                        payload = await node.client.getCurrentEnergyPrice(homeId);
                    } catch (error) {
                        payload = error;
                    }
                    break;
                case 'getCurrentEnergyPrices':
                    try {
                        payload = await node.client.getCurrentEnergyPrices();
                    } catch (error) {
                        payload = error;
                    }
                    break;
                case 'getTodaysEnergyPrices':
                    try {
                        payload = await node.client.getTodaysEnergyPrices(homeId);
                    } catch (error) {
                        payload = error;
                    }
                    break;
                case 'getTomorrowsEnergyPrices':
                    try {
                        payload = await node.client.getTomorrowsEnergyPrices(homeId);
                    } catch (error) {
                        payload = error;
                    }
                    break;
                case 'getConsumption':
                    try {
                        payload = await node.client.getConsumption(energyResolution, lastCount, homeId ? homeId : undefined);
                    } catch (error) {
                        payload = error;
                    }
                    break;
                default:
                    payload = { error: 'Unknown query: ' + queryName };
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
