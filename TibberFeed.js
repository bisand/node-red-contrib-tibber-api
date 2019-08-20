var WebSocket = require('ws');
var events = require('events');

class TibberFeed {
    constructor(config) {

        var self = this;
        self.apikey = config.apikey;
        self.homeid = config.homeid;

        if (!TibberFeed.ws)
            TibberFeed.ws = new WebSocket(config.apiUrl, ['graphql-ws']);

        var gql = 'subscription{\nliveMeasurement(homeId:\"' + self.homeid + '\"){\n';
        if (config.timestamp == 1)
            gql += 'timestamp\n';
        if (config.power == 1)
            gql += 'power\n';
        if (config.lastMeterConsumption == 1)
            gql += 'lastMeterConsumption\n';
        if (config.accumulatedConsumption == 1)
            gql += 'accumulatedConsumption\n';
        if (config.accumulatedProduction == 1)
            gql += 'accumulatedProduction\n';
        if (config.accumulatedCost == 1)
            gql += 'accumulatedCost\n';
        if (config.accumulatedReward == 1)
            gql += 'accumulatedReward\n';
        if (config.currency == 1)
            gql += 'currency\n';
        if (config.minPower == 1)
            gql += 'minPower\n';
        if (config.averagePower == 1)
            gql += 'averagePower\n';
        if (config.maxPower == 1)
            gql += 'maxPower\n';
        if (config.powerProduction == 1)
            gql += 'powerProduction\n';
        if (config.minPowerProduction == 1)
            gql += 'minPowerProduction\n';
        if (config.maxPowerProduction == 1)
            gql += 'maxPowerProduction\n';
        if (config.lastMeterProduction == 1)
            gql += 'lastMeterProduction\n';
        if (config.powerFactor == 1)
            gql += 'powerFactor\n';
        if (config.voltagePhase1 == 1)
            gql += 'voltagePhase1\n';
        if (config.voltagePhase2 == 1)
            gql += 'voltagePhase2\n';
        if (config.voltagePhase3 == 1)
            gql += 'voltagePhase3\n';
        if (config.currentPhase1 == 1)
            gql += 'currentPhase1\n';
        if (config.currentPhase2 == 1)
            gql += 'currentPhase2\n';
        if (config.currentPhase3 == 1)
            gql += 'currentPhase3\n';
        gql += '}}';
        self.query = {
            id: "1",
            type: "start",
            payload: {
                variables: {},
                extensions: {},
                operationName: null,
                query: gql
            }
        };

        self.events = new events.EventEmitter();

        TibberFeed.ws.on('open', function () {
            TibberFeed.ws.send('{"type":"connection_init","payload":"token=' + self.apikey + '"}')
            self.events.emit('connected', "Connected to Tibber feed");
        });

        TibberFeed.ws.on('message', function (message) {
            if (message.startsWith('{')) {
                var msg = JSON.parse(message);
                if (msg.type == 'connection_ack') {
                    self.events.emit('connection_ack', msg);
                    var str = JSON.stringify(self.query);
                    TibberFeed.ws.send(str);
                } else if (msg.type == "connection_error") {
                    self.events.emit('error', msg);
                } else if (msg.type == "data") {
                    if (!msg.payload.data)
                        return;
                    var data = msg.payload.data.liveMeasurement;
                    self.events.emit('data', data);
                }
            }
        });

        TibberFeed.ws.on('close', function (code) {
            self.events.emit('disconnected', "Disconnected from Tibber feed");
        });

        TibberFeed.ws.on('error', function (error) {
            self.events.emit('error', error);
        });

        self.close = function () {
            TibberFeed.ws.close();
            TibberFeed.ws.terminate();
            TibberFeed.ws = null;
        };
    }
}
module.exports = TibberFeed;