const { MISSING_PARAMETERS, getQueryClient, ensureAccessToken, toError } = require('./tibber-common');

module.exports = function (RED) {
    function TibberQueryNode(config) {
        RED.nodes.createNode(this, config);
        this._config = config;

        // The client is created here if the API endpoint is ready, otherwise when a message arrives after a login.
        if (!getQueryClient(RED, this, config)) {
            this.error(MISSING_PARAMETERS);
        }

        this.on('input', async (msg, send, done) => {
            const client = getQueryClient(RED, this, this._config);
            if (!client) {
                done(new Error(MISSING_PARAMETERS));
                return;
            }
            if (typeof msg.payload !== 'string' || !msg.payload) {
                done(new Error('Missing mandatory parameter (msg.payload must be a GraphQL query)'));
                return;
            }
            try {
                await ensureAccessToken(RED, this._config);
                msg.payload = await client.query(msg.payload);
                send(msg);
                done();
            } catch (error) {
                done(toError(error));
            }
        });
    }

    RED.nodes.registerType('tibber-query', TibberQueryNode);
};
