var WebSocket = require('ws');

// Get these parameters from config.
var apiToken = 'FROM_CONFIG';
var homeId = 'FROM_CONFIG';

var ws = new WebSocket("wss://api.tibber.com/v1-beta/gql/subscriptions", ['graphql-ws']);
var gql = 'subscription{\n  liveMeasurement(homeId:\"' + homeId + '\"){\n    timestamp\n    power\n    accumulatedConsumption\n    accumulatedCost\n    currency\n    minPower\n    averagePower\n    maxPower\n    voltagePhase1\n    currentPhase1\n    voltagePhase2\n    currentPhase2\n    voltagePhase3\n    currentPhase3\n  }\n}';
var query = {
    id: "1",
    type: "start",
    payload: {
        variables: {},
        extensions: {},
        operationName: null,
        query: gql
    }
};

ws.on('open', function () {
    console.log('Connected!');
    ws.send('{"type":"connection_init","payload":"token=' + apiToken + '"}')
});

ws.on('message', function (message) {
    if (message.startsWith('{')) {
        var msg = JSON.parse(message);
        if (msg.type == 'connection_ack') {
            console.log('Connected: ' + message);
            var str = JSON.stringify(query);
            ws.send(str);
        }
        else if (msg.type == "connection_error") {
            console.log('Error: ' + message);
        }
        else if (msg.type == "data") {
            var data = msg.payload.data.liveMeasurement;
            if (data.currentPhase1)
                console.log(JSON.stringify(data));
        }
    }
});

ws.on('close', function (code) {
    console.log('Disconnected: ' + code);
});

ws.on('error', function (error) {
    console.log('Error: ' + error.code);
});
