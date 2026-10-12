const { MISSING_PARAMETERS, getQueryClient, ensureAccessToken, toError, getPayload } = require('./tibber-common');

module.exports = function (RED) {
    function TibberUpdateHomeNode(config) {
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
                msg.payload = await client.updateHome(input);
                send(msg);
                done();
            } catch (error) {
                done(toError(error));
            }
        });
    }

    RED.nodes.registerType('tibber-update-home', TibberUpdateHomeNode);
};
