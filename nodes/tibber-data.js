require ('global-agent/bootstrap');
const TibberQuery = require('tibber-api').TibberQuery;

module.exports = function(RED) {
    function TibberDataNode(config) {
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
            var queryName = this._config.queryName ? this._config.queryName : msg.payload.queryName;
            var homeId = this._config.homeId ? this._config.homeId : msg.payload.homeId;
            var energyResolution = this._config.energyResolution ? this._config.energyResolution : msg.payload.energyResolution;
            var lastCount = Number(this._config.lastCount ? this._config.lastCount : msg.payload.lastCount);

            // Preserve default values.
            energyResolution = energyResolution ? energyResolution : 'HOURLY';
            if (isNaN(lastCount)) {
                lastCount = 10;
            }

            var payload = {};
            switch (queryName) {
                case 'getHome':
                    try {
                        payload = await this.client.getHome(homeId);
                    } catch (error) {
                        payload = error;
                    }
                    break;
                case 'getHomeComplete':
                    try {
                        payload = await this.client.getHomeComplete(homeId);
                    } catch (error) {
                        payload = error;
                    }
                    break;
                case 'getHomes':
                    try {
                        payload = await this.client.getHomes();
                    } catch (error) {
                        payload = error;
                    }
                    break;
                case 'getHomesComplete':
                    try {
                        payload = await this.client.getHomesComplete();
                    } catch (error) {
                        payload = error;
                    }
                    break;
                case 'getCurrentEnergyPrice':
                    try {
                        payload = await this.client.getCurrentEnergyPrice(homeId);
                    } catch (error) {
                        payload = error;
                    }
                    break;
                case 'getCurrentEnergyPrices':
                    try {
                        payload = await this.client.getCurrentEnergyPrices();
                    } catch (error) {
                        payload = error;
                    }
                    break;
                case 'getTodaysEnergyPrices':
                    try {
                        payload = await this.client.getTodaysEnergyPrices(homeId);
                    } catch (error) {
                        payload = error;
                    }
                    break;
                case 'getTomorrowsEnergyPrices':
                    try {
                        payload = await this.client.getTomorrowsEnergyPrices(homeId);
                    } catch (error) {
                        payload = error;
                    }
                    break;
                case 'getConsumption':
                    try {
                        payload = await this.client.getConsumption(energyResolution, lastCount, homeId ? homeId : undefined);
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
                this.send(message);
            }
        });
    }

    RED.nodes.registerType('tibber-data', TibberDataNode);
};
