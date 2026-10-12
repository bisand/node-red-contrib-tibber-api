const { MISSING_PARAMETERS, getQueryClient, ensureAccessToken, toError, getPayload } = require('./tibber-common');

module.exports = function (RED) {
    function TibberNotifyNode(config) {
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
            const title = this._config.notifyTitle ? this._config.notifyTitle : payload.title;
            const message = this._config.notifyMessage ? this._config.notifyMessage : payload.message;
            const screen = (this._config.notifyScreen ? this._config.notifyScreen : payload.screen) || 'HOME';

            if (!title || !message) {
                done(new Error('Missing mandatory parameters (title and/or message)'));
                return;
            }

            try {
                await ensureAccessToken(RED, this._config);
                const result = await client.sendPushNotification(message, title, screen);
                this.log(JSON.stringify(result));
                done();
            } catch (error) {
                done(toError(error));
            }
        });
    }

    RED.nodes.registerType('tibber-notify', TibberNotifyNode);
};
