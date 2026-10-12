const { MISSING_PARAMETERS, getQueryClient, ensureAccessToken, toError, getPayload } = require('./tibber-common');

// Convert a paging value from a message to what tibber-api expects: a Date, or a cursor from pageInfo.
function toCursor(value) {
    if (typeof value === 'number' || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value))) {
        return new Date(value);
    }
    return value || undefined;
}

// Price queries only accept HOURLY or QUARTER_HOURLY (PriceInfoResolution).
function toPriceResolution(resolution) {
    return resolution === 'QUARTER_HOURLY' ? 'QUARTER_HOURLY' : 'HOURLY';
}

const queries = {
    getHome: (client, p) => client.getHome(p.homeId),
    getHomeComplete: (client, p) => client.getHomeComplete(p.homeId),
    getHomes: (client) => client.getHomes(),
    getHomesComplete: (client) => client.getHomesComplete(),
    getCurrentEnergyPrice: (client, p) => client.getCurrentEnergyPrice(p.homeId, toPriceResolution(p.energyResolution)),
    getCurrentEnergyPrices: (client, p) => client.getCurrentEnergyPrices(toPriceResolution(p.energyResolution)),
    getTodaysEnergyPrices: (client, p) => client.getTodaysEnergyPrices(p.homeId, toPriceResolution(p.energyResolution)),
    getTomorrowsEnergyPrices: (client, p) => client.getTomorrowsEnergyPrices(p.homeId, toPriceResolution(p.energyResolution)),
    getEnergyPriceRange: (client, p) => client.getEnergyPriceRange(p.homeId, p.energyResolution, p.paging),
    getConsumption: (client, p) => client.getConsumption(p.energyResolution, p.lastCount, p.homeId ? p.homeId : undefined),
    getConsumptionPage: (client, p) => client.getConsumptionPage(p.homeId, p.energyResolution, p.paging),
    getProduction: (client, p) => client.getProduction(p.energyResolution, p.lastCount, p.homeId ? p.homeId : undefined),
    getProductionPage: (client, p) => client.getProductionPage(p.homeId, p.energyResolution, p.paging),
};

module.exports = function (RED) {
    function TibberDataNode(config) {
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
            const queryName = this._config.queryName ? this._config.queryName : payload.queryName;
            const homeId = this._config.homeId ? this._config.homeId : payload.homeId;
            // Preserve default values.
            const energyResolution = (this._config.energyResolution ? this._config.energyResolution : payload.energyResolution) || 'HOURLY';
            let lastCount = Number(this._config.lastCount ? this._config.lastCount : payload.lastCount);
            if (isNaN(lastCount)) {
                lastCount = 10;
            }

            // Paging for the page and range queries. Returns the last records unless the message says otherwise.
            const paging = {
                first: payload.first,
                last: payload.first === undefined ? (payload.last !== undefined ? payload.last : lastCount) : undefined,
                before: toCursor(payload.before),
                after: toCursor(payload.after),
                filterEmptyNodes: payload.filterEmptyNodes,
            };

            const query = Object.prototype.hasOwnProperty.call(queries, queryName) ? queries[queryName] : undefined;
            if (!query) {
                done(new Error('Unknown query: ' + queryName));
                return;
            }
            try {
                await ensureAccessToken(RED, this._config);
                msg.payload = await query(client, { homeId, energyResolution, lastCount, paging });
                send(msg);
                done();
            } catch (error) {
                done(toError(error));
            }
        });
    }

    RED.nodes.registerType('tibber-data', TibberDataNode);
};
