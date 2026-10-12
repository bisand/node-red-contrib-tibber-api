const { getDataClient, getDataClientError, toError, getPayload } = require('./tibber-common');

const queries = {
    getHomes: (client) => client.getHomes(),
    getDevices: (client, p) => client.getDevices(p.homeId),
    getDevice: (client, p) => client.getDevice(p.homeId, p.deviceId),
    getDeviceHistory: (client, p) =>
        // A link from a previous page takes precedence. Without since or until, the latest history is returned.
        p.link
            ? client.getDeviceHistoryPage(p.link)
            : client.getDeviceHistory(p.homeId, p.deviceId, {
                  resolution: p.resolution,
                  since: p.since,
                  until: p.since ? undefined : p.until || new Date(),
              }),
    getLiveEventDevices: (client, p) => client.getLiveEventDevices(p.homeId),
};

const required = {
    getDevices: ['homeId'],
    getDevice: ['homeId', 'deviceId'],
    getDeviceHistory: ['homeId', 'deviceId'],
    getLiveEventDevices: ['homeId'],
};

// Dates in messages can be Date objects, ISO 8601 strings or timestamps in milliseconds.
function toDate(value) {
    return typeof value === 'number' ? new Date(value) : value || undefined;
}

module.exports = function (RED) {
    function TibberDataApiNode(config) {
        RED.nodes.createNode(this, config);
        this._config = config;

        this.on('input', async (msg, send, done) => {
            const client = getDataClient(RED, this._config);
            if (!client) {
                done(new Error(getDataClientError(RED, this._config)));
                return;
            }

            const payload = getPayload(msg);
            const queryName = this._config.queryName ? this._config.queryName : payload.queryName;
            const params = {
                homeId: this._config.homeId ? this._config.homeId : payload.homeId,
                deviceId: this._config.deviceId ? this._config.deviceId : payload.deviceId,
                resolution: (this._config.resolution ? this._config.resolution : payload.resolution) || 'hour',
                since: toDate(payload.since),
                until: toDate(payload.until),
                link: payload.link,
            };

            const query = Object.prototype.hasOwnProperty.call(queries, queryName) ? queries[queryName] : undefined;
            if (!query) {
                done(new Error('Unknown query: ' + queryName));
                return;
            }
            const missing = params.link ? [] : (required[queryName] || []).filter((name) => !params[name]);
            if (missing.length > 0) {
                done(new Error(`Missing mandatory parameters (${missing.join(' and/or ')})`));
                return;
            }

            try {
                msg.payload = await query(client, params);
                send(msg);
                done();
            } catch (error) {
                done(toError(error));
            }
        });
    }

    RED.nodes.registerType('tibber-data-api', TibberDataApiNode);
};
