const TibberQuery = require('tibber-api').TibberQuery;
const { getApiConfig, ensureAccessToken, getTimeout, toError, getPayload } = require('./tibber-common');

module.exports = function (RED) {
    function TibberUpdateHomeNode(config) {
        RED.nodes.createNode(this, config);
        this._config = config;

        const apiConfig = getApiConfig(RED, config);
        if (!apiConfig) {
            this.error('Missing mandatory parameters (queryUrl and/or accessToken). Log in or enter an access token on the API endpoint.');
            return;
        }

        this.client = new TibberQuery(apiConfig, getTimeout(RED, config, 'queryRequestTimeout', 30));

        this.on('input', async (msg, send, done) => {
            const payload = getPayload(msg);
            const homeId = this._config.homeId ? this._config.homeId : payload.homeId;

            if (!homeId) {
                done(new Error('Missing mandatory parameter (homeId)'));
                return;
            }

            const input = { homeId: homeId };
            // Optional home properties. Values from the incoming message payload.
            ['appNickname', 'appAvatar', 'size', 'type', 'numberOfResidents', 'primaryHeatingSource', 'hasVentilationSystem', 'mainFuseSize'].forEach((prop) => {
                if (payload[prop] !== undefined) {
                    input[prop] = payload[prop];
                }
            });

            try {
                await ensureAccessToken(RED, this._config);
                msg.payload = await this.client.updateHome(input);
                send(msg);
                done();
            } catch (error) {
                done(toError(error));
            }
        });
    }

    RED.nodes.registerType('tibber-update-home', TibberUpdateHomeNode);
};
