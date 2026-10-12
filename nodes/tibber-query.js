const TibberQuery = require('tibber-api').TibberQuery;
const { getApiConfig, ensureAccessToken, getTimeout, toError } = require('./tibber-common');

module.exports = function (RED) {
    function TibberQueryNode(config) {
        RED.nodes.createNode(this, config);
        this._config = config;

        const apiConfig = getApiConfig(RED, config);
        if (!apiConfig) {
            this.error('Missing mandatory parameters (queryUrl and/or accessToken). Log in or enter an access token on the API endpoint.');
            return;
        }

        this.client = new TibberQuery(apiConfig, getTimeout(RED, config, 'queryRequestTimeout', 30));

        this.on('input', async (msg, send, done) => {
            if (typeof msg.payload !== 'string' || !msg.payload) {
                done(new Error('Missing mandatory parameter (msg.payload must be a GraphQL query)'));
                return;
            }
            try {
                await ensureAccessToken(RED, this._config);
                msg.payload = await this.client.query(msg.payload);
                send(msg);
                done();
            } catch (error) {
                done(toError(error));
            }
        });
    }

    RED.nodes.registerType('tibber-query', TibberQueryNode);
};
