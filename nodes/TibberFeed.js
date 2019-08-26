const WebSocket = require('ws');
const events = require('events');

class TibberFeed {
    constructor(config) {

        var node = this;
        node._config = config;
        node.active = false;

        if (!config.apikey || !config.homeid || !config.apiUrl)
            return;

        var _gql = 'subscription{\nliveMeasurement(homeId:"' + node._config.homeid + '"){\n';
        if (node._config.timestamp == 1)
            _gql += 'timestamp\n';
        if (node._config.power == 1)
            _gql += 'power\n';
        if (node._config.lastMeterConsumption == 1)
            _gql += 'lastMeterConsumption\n';
        if (node._config.accumulatedConsumption == 1)
            _gql += 'accumulatedConsumption\n';
        if (node._config.accumulatedProduction == 1)
            _gql += 'accumulatedProduction\n';
        if (node._config.accumulatedCost == 1)
            _gql += 'accumulatedCost\n';
        if (node._config.accumulatedReward == 1)
            _gql += 'accumulatedReward\n';
        if (node._config.currency == 1)
            _gql += 'currency\n';
        if (node._config.minPower == 1)
            _gql += 'minPower\n';
        if (node._config.averagePower == 1)
            _gql += 'averagePower\n';
        if (node._config.maxPower == 1)
            _gql += 'maxPower\n';
        if (node._config.powerProduction == 1)
            _gql += 'powerProduction\n';
        if (node._config.minPowerProduction == 1)
            _gql += 'minPowerProduction\n';
        if (node._config.maxPowerProduction == 1)
            _gql += 'maxPowerProduction\n';
        if (node._config.lastMeterProduction == 1)
            _gql += 'lastMeterProduction\n';
        if (node._config.powerFactor == 1)
            _gql += 'powerFactor\n';
        if (node._config.voltagePhase1 == 1)
            _gql += 'voltagePhase1\n';
        if (node._config.voltagePhase2 == 1)
            _gql += 'voltagePhase2\n';
        if (node._config.voltagePhase3 == 1)
            _gql += 'voltagePhase3\n';
        if (node._config.currentPhase1 == 1)
            _gql += 'currentPhase1\n';
        if (node._config.currentPhase2 == 1)
            _gql += 'currentPhase2\n';
        if (node._config.currentPhase3 == 1)
            _gql += 'currentPhase3\n';
        _gql += '}}';
        node._query = {
            id: "1",
            type: "start",
            payload: {
                variables: {},
                extensions: {},
                operationName: null,
                query: _gql
            }
        };

        node.events = new events.EventEmitter();

        node._webSocket.on('open', function () {
            node._webSocket.send('{"type":"connection_init","payload":"token=' + node.apikey + '"}');
            node.events.emit('connected', "Connected to Tibber feed");
        });

        node._webSocket.on('message', function (message) {
            if (message.startsWith('{')) {
                var msg = JSON.parse(message);
                if (msg.type == 'connection_ack') {
                    node.events.emit('connection_ack', msg);
                    var str = JSON.stringify(node._query);
                    node._webSocket.send(str);
                } else if (msg.type == "connection_error") {
                    node.events.emit('error', msg);
                    if (node._webSocket)
                        node._webSocket.close();
                } else if (msg.type == "data") {
                    if (!msg.payload.data)
                        return;
                    var data = msg.payload.data.liveMeasurement;
                    node.events.emit('data', data);
                    node.heartbeat();
                }
            }
        });

        node._webSocket.on('close', function () {
            node.events.emit('disconnected', "Disconnected from Tibber feed");
            clearTimeout(node._pingTimeout);
        });

        node._webSocket.on('error', function (error) {
            node.events.emit('error', error);
        });

        node.connect();
    }

    connect() {
        this._webSocket = new WebSocket(this._config.apiUrl, ['graphql-ws']);
    }

    close() {
        this._webSocket.close();
        this._webSocket.terminate();
        this._webSocket = null;
        console.log('Closed Tibber Feed.');
    }

    heartbeat() {
        var node = this;
        clearTimeout(this._pingTimeout);
        // Use `WebSocket#terminate()`, which immediately destroys the connection,
        // instead of `WebSocket#close()`, which waits for the close timer.
        // Delay should be equal to the interval at which your server
        // sends out pings plus a conservative assumption of the latency.
        this._pingTimeout = setTimeout(() => {
            node._webSocket.terminate();
            this.connect();
        }, 30000 + 1000);
    }
}

module.exports = TibberFeed;