# node-red-contrib-tibber-api

Node Red module for integrating with Tibber api.

*Warning! This is early stage development.*

|  Branch  | Status           |
|----------|------------------|
|develop   | [![Build Status](https://travis-ci.org/bisand/node-red-contrib-tibber-api.svg?branch=develop)](https://travis-ci.org/bisand/node-red-contrib-tibber-api) |
| master | [![Build Status](https://travis-ci.org/bisand/node-red-contrib-tibber-api.svg?branch=master)](https://travis-ci.org/bisand/node-red-contrib-tibber-api) |
 
## General
This Node-Red module is used for communication with Tipper API.

## Prerequisites
You will need an API token. Register here

> https://developer.tibber.com/


## Installation

### NPM package
> https://www.npmjs.com/package/node-red-contrib-tibber-api

### Node-Red
##### To install module in Node-Red GUI
1. Go to main menu.
2. Select **Manage palette**. 
3. Select **Install** tab.
4. Search for **node-red-contrib-tibber-api**
5. Click **Install** button to perform the installation.

##### Manual installation
```bash
$ npm install node-red-contrib-tibber-api
```

## Nodes

### Tibber Feed node (*tibber-feed*)
![tibber-feed](examples/images/tibber-feed.png)

Realtime power consuption data from Tibber Pulse. Provide API token, Home ID and select what kind of information you want to retrieve.
> Note! There can be only one instance of *tibber-feed* per API key. Doing otherwise may return unpredictable result, or even error response from the API.

### Tibber API call node (*tibber-query*)
![tibber-query](examples/images/tibber-query.png)

Do basic calls to Tibber API using GraphQL queries. To query the Tibber API, simply provide raw GraphQL queries in the payload of the incoming message. See Tibber API documentation and API Explorer for more informations.

### Tibber push notification (*tibber-notify*)
![tibber-notify](examples/images/tibber-notify.png)

Send push nofifications to connected TIbber apps via Tibber API using GraphQL queries. Fill in Title, Message and which screen to open in the app directly in the node, or by providing the data via the incomming .

### Tibber data (*tibber-data*)
**TODO!**
Select from a set of predefined queries to retrieve data from Tibber API.

## Examples
<details>
  <summary>Node-Red Example flow</summary>
  <p>

### Tibber Test Flow.json
```json
[
    {
        "id": "4e0718b1.2af2a8",
        "type": "tab",
        "label": "Tibber Test Flow",
        "disabled": false,
        "info": ""
    },
    {
        "id": "8099995f.515738",
        "type": "inject",
        "z": "4e0718b1.2af2a8",
        "name": "",
        "topic": "",
        "payload": "{viewer{homes{id size appNickname appAvatar address{address1 address2 address3 postalCode city country latitude longitude}}}}",
        "payloadType": "str",
        "repeat": "",
        "crontab": "",
        "once": false,
        "onceDelay": 0.1,
        "x": 130,
        "y": 80,
        "wires": [
            [
                "28454c92.811574"
            ]
        ]
    },
    {
        "id": "944c04ef.7b6638",
        "type": "debug",
        "z": "4e0718b1.2af2a8",
        "name": "",
        "active": true,
        "tosidebar": true,
        "console": false,
        "tostatus": false,
        "complete": "false",
        "x": 570,
        "y": 80,
        "wires": []
    },
    {
        "id": "c80cad4f.7a806",
        "type": "tibber-feed",
        "z": "4e0718b1.2af2a8",
        "name": "",
        "active": true,
        "apiUrl": "wss://api.tibber.com/v1-beta/gql/subscriptions",
        "apiToken": "d1007ead2dc84a2b82f0de19451c5fb22112f7ae11d19bf2bedb224a003ff74a",
        "homeId": "c70dcbe5-4485-4821-933d-a8a86452737b",
        "timestamp": "1",
        "power": "1",
        "lastMeterConsumption": "1",
        "accumulatedConsumption": "1",
        "accumulatedProduction": "1",
        "accumulatedCost": "1",
        "accumulatedReward": "1",
        "currency": "1",
        "minPower": "1",
        "averagePower": "1",
        "maxPower": "1",
        "powerProduction": "1",
        "minPowerProduction": "1",
        "maxPowerProduction": "1",
        "lastMeterProduction": "1",
        "powerFactor": "1",
        "voltagePhase1": "1",
        "voltagePhase2": "1",
        "voltagePhase3": "1",
        "currentPhase1": "1",
        "currentPhase2": "1",
        "currentPhase3": "1",
        "x": 120,
        "y": 180,
        "wires": [
            [
                "781f5eed.ea2a3"
            ]
        ]
    },
    {
        "id": "781f5eed.ea2a3",
        "type": "debug",
        "z": "4e0718b1.2af2a8",
        "name": "",
        "active": true,
        "tosidebar": true,
        "console": false,
        "tostatus": false,
        "complete": "false",
        "x": 350,
        "y": 180,
        "wires": []
    },
    {
        "id": "28454c92.811574",
        "type": "tibber-query",
        "z": "4e0718b1.2af2a8",
        "name": "",
        "active": true,
        "apiUrl": "https://api.tibber.com/v1-beta/gql",
        "apiToken": "d1007ead2dc84a2b82f0de19451c5fb22112f7ae11d19bf2bedb224a003ff74a",
        "x": 350,
        "y": 80,
        "wires": [
            [
                "944c04ef.7b6638"
            ]
        ]
    },
    {
        "id": "f3a4184a.047968",
        "type": "tibber-notify",
        "z": "4e0718b1.2af2a8",
        "name": "",
        "active": true,
        "apiUrl": "https://api.tibber.com/v1-beta/gql",
        "apiToken": "d1007ead2dc84a2b82f0de19451c5fb22112f7ae11d19bf2bedb224a003ff74a",
        "notifyTitle": "",
        "notifyMessage": "",
        "notifyScreen": "",
        "x": 330,
        "y": 300,
        "wires": []
    },
    {
        "id": "b0e33b71.865f18",
        "type": "inject",
        "z": "4e0718b1.2af2a8",
        "name": "",
        "topic": "",
        "payload": "{\"title\":\"Test\",\"message2\":\"Dette er en test\",\"screen\":\"HOME\"}",
        "payloadType": "json",
        "repeat": "",
        "crontab": "",
        "once": false,
        "onceDelay": 0.1,
        "x": 120,
        "y": 300,
        "wires": [
            [
                "f3a4184a.047968"
            ]
        ]
    }
]
```
</p></details>

## License
[MIT](https://choosealicense.com/licenses/mit/)
