const { TibberDataFeed } = require('tibber-api');
const { toError } = require('./tibber-common');
const { getClient } = require('./tibber-data-api-common');

module.exports = function (RED) {
    function TibberDataApiFeedNode(config) {
        RED.nodes.createNode(this, config);
        this._config = config;
        this._closed = false;

        this.status({ fill: 'red', shape: 'ring', text: 'disconnected' });

        this._start = async () => {
            const client = getClient(RED, config);
            if (!client) {
                this.status({ fill: 'red', shape: 'dot', text: 'not logged in' });
                this.warn('Not logged in to Tibber. Open the Data API endpoint and log in.');
                return;
            }
            try {
                this.status({ fill: 'green', shape: 'ring', text: 'connecting' });
                let homeId = config.homeId;
                if (!homeId) {
                    const homes = await client.getHomes();
                    homeId = homes.length > 0 ? homes[0].id : undefined;
                }
                if (!homeId) {
                    throw new Error('No home found');
                }
                // Use the configured devices, or the devices that can be streamed right now.
                let deviceIds = String(config.deviceIds || '').split(/[\s,]+/).filter(Boolean);
                if (deviceIds.length === 0) {
                    deviceIds = (await client.getLiveEventDevices(homeId)).map((device) => device.id).slice(0, TibberDataFeed.MAX_DEVICES);
                }
                if (deviceIds.length === 0) {
                    throw new Error('No devices can stream live measurements');
                }
                if (this._closed) {
                    return;
                }

                const feed = (this._feed = new TibberDataFeed(client, homeId, deviceIds));
                feed.on('connecting', () => this.status({ fill: 'green', shape: 'ring', text: 'connecting' }));
                feed.on('connected', () => this.status({ fill: 'green', shape: 'dot', text: 'connected' }));
                feed.on('disconnected', () => {
                    // Keep the reason on display when the feed has been closed by the server.
                    if (feed.active) this.status({ fill: 'red', shape: 'ring', text: 'disconnected' });
                });
                feed.on('data', (data) => this.send({ topic: data.deviceId, payload: data }));
                let stopReason;
                feed.on('stream_error', (data) => {
                    if (!data.transient) stopReason = String(data.code).replace(/_/g, ' ');
                });
                feed.on('error', (error) => {
                    if (!feed.active) this.status({ fill: 'red', shape: 'dot', text: stopReason || 'stopped' });
                    this.error('TibberDataFeed error: ' + toError(error).message);
                });
                feed.on('warn', (message) => this.warn(message));
                feed.on('log', (message) => this.log(message));
                await feed.connect();
            } catch (error) {
                this.status({ fill: 'red', shape: 'dot', text: 'error' });
                this.error('TibberDataFeed error: ' + toError(error).message);
            }
        };

        this.on('close', (removed, done) => {
            this._closed = true;
            clearTimeout(this._connectionDelay);
            if (this._feed) {
                this._feed.close();
                this._feed.removeAllListeners();
                this._feed = null;
            }
            this.status({ fill: 'red', shape: 'ring', text: 'disconnected' });
            done();
        });

        if (!config.active) {
            this.log('Node is not active, skipping initialization.');
            return;
        }

        this._connectionDelay = setTimeout(() => this._start(), 1000);
    }

    RED.nodes.registerType('tibber-data-api-feed', TibberDataApiFeedNode);
};
