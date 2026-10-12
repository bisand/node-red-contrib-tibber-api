const TibberQuery = require('tibber-api').TibberQuery;
const { getApiConfig, ensureAccessToken, getTimeout, toError, getPayload } = require('./tibber-common');

module.exports = function (RED) {
    function TibberNotifyNode(config) {
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
            const title = this._config.notifyTitle ? this._config.notifyTitle : payload.title;
            const message = this._config.notifyMessage ? this._config.notifyMessage : payload.message;
            const screen = (this._config.notifyScreen ? this._config.notifyScreen : payload.screen) || 'HOME';

            if (!title || !message) {
                done(new Error('Missing mandatory parameters (title and/or message)'));
                return;
            }

            try {
                await ensureAccessToken(RED, this._config);
                const result = await this.client.sendPushNotification(message, title, screen);
                this.log(JSON.stringify(result));
                done();
            } catch (error) {
                done(toError(error));
            }
        });
    }

    RED.nodes.registerType('tibber-notify', TibberNotifyNode);
};
