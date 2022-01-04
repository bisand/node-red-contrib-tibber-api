# node-red-contrib-tibber-api

Node Red module for integrating with Tibber Pulse through Tibber api.

|  Branch  | Status           |
|----------|------------------|
| develop  | [![Build Status](https://app.travis-ci.com/bisand/node-red-contrib-tibber-api.svg?branch=develop)](https://app.travis-ci.com/bisand/node-red-contrib-tibber-api) |
| master | [![Build Status](https://app.travis-ci.com/bisand/node-red-contrib-tibber-api.svg?branch=master)](https://app.travis-ci.com/bisand/node-red-contrib-tibber-api) |
 
## General

This Node-Red module is used for communication with [Tibber API](https://developer.tibber.com/) through [GraphQL](https://developer.tibber.com/docs/overview) queries and for retrieving data from Tibber Pulse via websocket.
[Tibber](https://tibber.com) is a norwegian technology focused power company which is providing tools to get more insight and controll over your home and its power consumption.

> Note! From version 1.2.0 the API key has been moved to [Credentials](https://nodered.org/docs/creating-nodes/credentials) and renamed to Access Token. This has been done to prevent the Access Token to be exported when flows are exported. The transition should be seamless, and any stored API keys should be automatically converted to Access Token [Credentials](https://nodered.org/docs/creating-nodes/credentials). Please register an issue if you should experience any problems related to this.

## Prerequisites

Click the link below to sign up, and receive 500 NOK to shop smart home gadgets from [Tibber Store](https://tibber.com/no/store):

> https://invite.tibber.com/3ea6e31f

You will also need an API token from Tibber. Get it here:

> https://developer.tibber.com/

> Note! In order to use the included Grafana dashboard example, you will need Grafana 6.x or higher.

## Installation

### NPM package

> https://www.npmjs.com/package/node-red-contrib-tibber-api

### Node-Red

#### To install module in Node-Red GUI

1. Go to main menu.
2. Select **Manage palette**. 
3. Select **Install** tab.
4. Search for **node-red-contrib-tibber-api**
5. Click **Install** button to perform the installation.

#### Manual installation

```bash
$ npm install node-red-contrib-tibber-api
```

## Nodes

### Tibber Feed node (*tibber-feed*)

![tibber-feed](examples/images/tibber-feed.png)

Realtime power consuption data from Tibber Pulse. Provide API token, Home ID and select what kind of information you want to retrieve.
> Note! There should be only one instance running of *tibber-feed* per API key. Doing otherwise may return unpredictable result, or even error responses from the API.

### Tibber API call node (*tibber-query*)

![tibber-query](examples/images/tibber-query.png)

Do basic calls to Tibber API using GraphQL queries. To query the Tibber API, simply provide raw GraphQL queries in the payload of the incoming message. See Tibber API documentation and API Explorer for more informations.

### Tibber push notification (*tibber-notify*)

![tibber-notify](examples/images/tibber-notify.png)

Send push nofifications to connected TIbber apps via Tibber API using GraphQL queries. Fill in Title, Message and which screen to open in the app directly in the node, or by providing the data via the incomming .

### Tibber data (*tibber-data*)

Select from a set of predefined queries to retrieve data from Tibber API.
The additional parameters can be provided either by the message payload or by configuring the node itself. By using the message payload you will be able to select query and parameters provided by other nodes in the flow.

Payload example:
```json
{
    "queryName": "getTomorrowsEnergyPrices",
    "homeId": "c70dcbe5-4485-4821-933d-a8a86452737b",
    "energyResolution": "DAILY",
    "lastCount": 14
}
```

Available queries:
```javascript
    /**
     * Get selected home with some selected properties, including address and owner.
     * @param homeId Tibber home ID
     * @return IHome object
     */
    getHome(homeId: string): IHome;
    
    /**
     * Get homes with all properties, including energy price, consumption and production.
     * @param homeId Tibber home ID
     * @return IHome object
     */
    getHomeComplete(homeId: string): IHome;
    
    /**
     * Get homes with some selected properties, including address and owner.
     * @return Array of IHome.
     */
    getHomes(): IHome[];
    
    /**
     * Get homes with all properties, including energy price, consumption and production.
     * @return Array of IHome
     */
    getHomesComplete(): IHome[];
    
    /**
     * Get current energy price for selected home.
     * @param homeId Tibber home ID
     * @return IPrice object
     */
    getCurrentEnergyPrice(homeId: string): IPrice;
    
    /**
     * Get current energy prices from all homes registered to current user
     * @return Array of IPrice
     */
    getCurrentEnergyPrices(): IPrice[];
    
    /**
     * Get energy prices for today.
     * @param homeId Tibber home ID
     * @return Array of IPrice
     */
    getTodaysEnergyPrices(homeId: string): IPrice[];
    
    /**
     * Get energy prices for tomorrow. These will only be available between 12:00 and 23:59
     * @param homeId Tibber home ID
     * @return Array of IPrice
     */
    getTomorrowsEnergyPrices(homeId: string): IPrice[];
    
    /**
     * Get energy consumption for one or more homes.
     * Returns an array of IConsumption
     * @param energyResolution EnergyResolution. Valid values: HOURLY, DAILY, WEEKLY, MONTHLY, ANNUAL
     * @param lastCount Return the last number of records
     * @param homeId Tibber home ID. Optional parameter. Empty parameter will return all registered homes.
     * @return Array of IConsumption
     */
    getConsumption(energyResolution: EnergyResolution, lastCount: number, homeId?: string): IConsumption[];
```

### Configuration node (*tibber-api-endpoint*)

![tibber-api-endpoint](examples/images/tibber-api-endpoint.png)

When configuring regular tibber nodes, you will have to create or select the configuration from the property **API Endpoint**. Here you can specify **Query URL**, **WebSocket URL** and **API Key**. This configuration can easily be used by any Tibber nodes. This will greatly simplyfy changing of urls and API key, since the change happens on all nodes using the configuration.

## Examples

To easily test out the examples, you should use a server stack containing Node-Red, InfluxDB, and Grafana. Such stack can easily be installed by using the following docker based IoTServer: <https://github.com/bisand/iotserver>

Installation instructions:

```sh
git clone https://github.com/bisand/IoTServer.git iotserver
cd iotserver
sudo ./init.sh
```

Read the included [readme](https://github.com/bisand/IoTServer/blob/master/README.md) for more info.

### Node-Red examples

<details>
  <summary>Tibber Pulse - Example flow</summary>
  <p>

### tibber-test-flow.json

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
        "currentL1": "1",
        "currentL2": "1",
        "currentL3": "1",
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
        "payload": "{\"title\":\"Test\",\"message\":\"This is a simple test\",\"screen\":\"HOME\"}",
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

<details>
  <summary>Tibber Pulse - Home power  consumption example</summary>
  <p>

### home-power.json

```json
[
  {
    "id": "683fd7.e63da028",
    "type": "tab",
    "label": "Home Energy",
    "disabled": false,
    "info": ""
  },
  {
    "id": "b970f3b0.3ff74",
    "type": "tibber-feed",
    "z": "683fd7.e63da028",
    "name": "",
    "active": true,
    "apiEndpointRef": "8a80f84f.0cbd98",
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
    "currentL1": "1",
    "currentL2": "1",
    "currentL3": "1",
    "x": 140,
    "y": 300,
    "wires": [["1491f46.f317b0c"]]
  },
  {
    "id": "4d0b020a.94fbac",
    "type": "debug",
    "z": "683fd7.e63da028",
    "name": "",
    "active": false,
    "tosidebar": true,
    "console": false,
    "tostatus": false,
    "complete": "false",
    "x": 590,
    "y": 360,
    "wires": []
  },
  {
    "id": "2773a5f1.d99aca",
    "type": "tibber-query",
    "z": "683fd7.e63da028",
    "name": "",
    "active": true,
    "apiEndpointRef": "8a80f84f.0cbd98",
    "x": 370,
    "y": 100,
    "wires": [["4a25248d.5e506c"]]
  },
  {
    "id": "983cd36.d80383",
    "type": "inject",
    "z": "683fd7.e63da028",
    "name": "Get Home Id",
    "topic": "",
    "payload": "{   viewer {     homes {       id       address {         address1         address2         address3         postalCode         city         country         latitude         longitude                }     }   } }",
    "payloadType": "str",
    "repeat": "",
    "crontab": "",
    "once": false,
    "onceDelay": 0.1,
    "x": 150,
    "y": 100,
    "wires": [["2773a5f1.d99aca"]]
  },
  {
    "id": "4a25248d.5e506c",
    "type": "debug",
    "z": "683fd7.e63da028",
    "name": "",
    "active": true,
    "tosidebar": true,
    "console": false,
    "tostatus": false,
    "complete": "false",
    "x": 550,
    "y": 100,
    "wires": []
  },
  {
    "id": "e0404127.1a2f8",
    "type": "http request",
    "z": "683fd7.e63da028",
    "name": "",
    "method": "POST",
    "ret": "txt",
    "paytoqs": false,
    "url": "http://influxdb:8086/write?precision=s&consistency=any&db=test",
    "tls": "",
    "proxy": "",
    "authType": "",
    "x": 590,
    "y": 300,
    "wires": [["4d0b020a.94fbac"]]
  },
  {
    "id": "1491f46.f317b0c",
    "type": "function",
    "z": "683fd7.e63da028",
    "name": "Transform payload",
    "func": "let p = msg.payload;\n\nif (!p.voltagePhase1)\n    return null;\n\nfor (var prop in p) {\n    if (!p[prop])\n        p[prop] = 0;\n}\n\n// Meassurement\nlet data = \"power\";\n\n// Tag set\ndata += \",location=test\";\ndata += \",currency=\" + p.currency;\n\n// Field set\ndata += \" power=\" + p.power;\ndata += \",lastMeterConsumption=\" + p.lastMeterConsumption;\ndata += \",accumulatedConsumption=\" + p.accumulatedConsumption;\ndata += \",accumulatedProduction=\" + p.accumulatedProduction;\ndata += \",accumulatedCost=\" + p.accumulatedCost;\ndata += \",accumulatedReward=\" + p.accumulatedReward;\ndata += \",minPower=\" + p.minPower;\ndata += \",averagePower=\" + p.averagePower;\ndata += \",maxPower=\" + p.maxPower;\ndata += \",powerProduction=\" + p.powerProduction;\ndata += \",minPowerProduction=\" + p.minPowerProduction;\ndata += \",maxPowerProduction=\" + p.maxPowerProduction;\ndata += \",lastMeterProduction=\" + p.lastMeterProduction;\ndata += \",powerFactor=\" + p.powerFactor;\ndata += \",voltagePhase1=\" + p.voltagePhase1;\ndata += \",voltagePhase2=\" + p.voltagePhase2;\ndata += \",voltagePhase3=\" + p.voltagePhase3;\ndata += \",currentL1=\" + p.currentL1;\ndata += \",currentL2=\" + p.currentL2;\ndata += \",currentL3=\" + p.currentL3;\n\nmsg.payload = data;\n\nreturn msg;\n",
    "outputs": 1,
    "noerr": 0,
    "x": 390,
    "y": 300,
    "wires": [["e0404127.1a2f8"]]
  },
  {
    "id": "4286466c.a02e08",
    "type": "http request",
    "z": "683fd7.e63da028",
    "name": "",
    "method": "POST",
    "ret": "txt",
    "paytoqs": false,
    "url": "http://influxdb:8086/query?q=CREATE%20DATABASE%20%22test%22",
    "tls": "",
    "proxy": "",
    "authType": "",
    "x": 370,
    "y": 40,
    "wires": [["d102d972.8fb0c8"]]
  },
  {
    "id": "b24ffef4.c3ca",
    "type": "inject",
    "z": "683fd7.e63da028",
    "name": "Create test database",
    "topic": "",
    "payload": "",
    "payloadType": "str",
    "repeat": "",
    "crontab": "",
    "once": false,
    "onceDelay": 0.1,
    "x": 170,
    "y": 40,
    "wires": [["4286466c.a02e08"]]
  },
  {
    "id": "d102d972.8fb0c8",
    "type": "debug",
    "z": "683fd7.e63da028",
    "name": "",
    "active": true,
    "tosidebar": true,
    "console": false,
    "tostatus": false,
    "complete": "false",
    "x": 550,
    "y": 40,
    "wires": []
  },
  {
    "id": "165b29ab.c7bef6",
    "type": "tibber-query",
    "z": "683fd7.e63da028",
    "name": "",
    "active": true,
    "apiEndpointRef": "8a80f84f.0cbd98",
    "x": 370,
    "y": 180,
    "wires": [["9f49c320.526db"]]
  },
  {
    "id": "425b3d0d.8f10d4",
    "type": "inject",
    "z": "683fd7.e63da028",
    "name": "Daily energy prices",
    "topic": "",
    "payload": "{   viewer {     homes {       currentSubscription {         priceInfo {           today {             total             energy             tax             startsAt             currency             level           }         }       }     }   } }",
    "payloadType": "str",
    "repeat": "",
    "crontab": "30 00 * * *",
    "once": false,
    "onceDelay": 0.1,
    "x": 180,
    "y": 180,
    "wires": [["165b29ab.c7bef6"]]
  },
  {
    "id": "810b8faa.9656a",
    "type": "debug",
    "z": "683fd7.e63da028",
    "name": "",
    "active": true,
    "tosidebar": true,
    "console": false,
    "tostatus": false,
    "complete": "payload",
    "targetType": "msg",
    "x": 550,
    "y": 240,
    "wires": []
  },
  {
    "id": "9f49c320.526db",
    "type": "function",
    "z": "683fd7.e63da028",
    "name": "Transform energy price",
    "func": "let pl = msg.payload;\n\nlet prices = pl.viewer.homes[0].currentSubscription.priceInfo.today;\n\n// Meassurement\nlet data = \"\";\n\nfor(let i = 0; i < prices.length; i++)\n{\n    let p = prices[i];\n    data += \"energy\";\n\n    // Tag set\n    data += \",location=test\";\n    data += \",currency=\" + p.currency;\n    \n    // Field set\n    data += \" total=\" + p.total;\n    data += \",energy=\" + p.energy;\n    data += \",tax=\" + p.tax;\n    data += \",level=\\\"\" + p.level + \"\\\"\";\n    data += \" \" + new Date(p.startsAt).getTime() / 1000 + \"\";\n    data += \"\\n\";\n}\n\nmsg.payload = data;\n\nreturn msg;",
    "outputs": 1,
    "noerr": 0,
    "x": 590,
    "y": 180,
    "wires": [["c478abbd.5715e8"]]
  },
  {
    "id": "c478abbd.5715e8",
    "type": "http request",
    "z": "683fd7.e63da028",
    "name": "",
    "method": "POST",
    "ret": "txt",
    "paytoqs": false,
    "url": "http://influxdb:8086/write?precision=s&consistency=any&db=test",
    "tls": "",
    "proxy": "",
    "authType": "",
    "x": 370,
    "y": 240,
    "wires": [["810b8faa.9656a"]]
  },
  {
    "id": "8a80f84f.0cbd98",
    "type": "tibber-api-endpoint",
    "z": "",
    "feedUrl": "wss://api.tibber.com/v1-beta/gql/subscriptions",
    "queryUrl": "https://api.tibber.com/v1-beta/gql",
    "apiKey": "d1007ead2dc84a2b82f0de19451c5fb22112f7ae11d19bf2bedb224a003ff74a",
    "name": "Demo"
  }
]
```

</p></details>

### Grafana example dashboard

<details>
  <summary>Grafana - Home power  consumption dashboard example</summary>
  <p>

### home-power-dashboard.json

```json
{
  "annotations": {
    "list": [
      {
        "builtIn": 1,
        "datasource": "-- Grafana --",
        "enable": true,
        "hide": true,
        "iconColor": "rgba(0, 211, 255, 1)",
        "name": "Annotations & Alerts",
        "type": "dashboard"
      }
    ]
  },
  "editable": true,
  "gnetId": null,
  "graphTooltip": 0,
  "id": 1,
  "links": [],
  "panels": [
    {
      "gridPos": {
        "h": 5,
        "w": 4,
        "x": 0,
        "y": 0
      },
      "id": 6,
      "options": {
        "fieldOptions": {
          "calcs": [
            "lastNotNull"
          ],
          "defaults": {
            "mappings": [],
            "max": 260,
            "min": 200,
            "thresholds": [
              {
                "color": "red",
                "value": null
              },
              {
                "color": "dark-red",
                "value": 200
              },
              {
                "color": "yellow",
                "value": 210
              },
              {
                "color": "green",
                "value": 220
              },
              {
                "color": "green",
                "value": 230
              },
              {
                "color": "#EAB839",
                "value": 240
              },
              {
                "color": "dark-red",
                "value": 250
              }
            ],
            "unit": "volt"
          },
          "override": {},
          "values": false
        },
        "orientation": "auto",
        "showThresholdLabels": true,
        "showThresholdMarkers": true
      },
      "pluginVersion": "6.3.5",
      "targets": [
        {
          "groupBy": [
            {
              "params": [
                "$interval"
              ],
              "type": "time"
            },
            {
              "params": [
                "previous"
              ],
              "type": "fill"
            }
          ],
          "measurement": "power",
          "orderByTime": "ASC",
          "policy": "default",
          "query": "SELECT last(\"voltagePhase1\") FROM \"power\" WHERE $timeFilter",
          "rawQuery": false,
          "refId": "A",
          "resultFormat": "time_series",
          "select": [
            [
              {
                "params": [
                  "voltagePhase1"
                ],
                "type": "field"
              },
              {
                "params": [],
                "type": "last"
              }
            ]
          ],
          "tags": []
        }
      ],
      "timeFrom": null,
      "timeShift": null,
      "title": "Voltage - Phase 1",
      "type": "gauge"
    },
    {
      "gridPos": {
        "h": 5,
        "w": 4,
        "x": 4,
        "y": 0
      },
      "id": 7,
      "options": {
        "fieldOptions": {
          "calcs": [
            "lastNotNull"
          ],
          "defaults": {
            "mappings": [],
            "max": 260,
            "min": 200,
            "thresholds": [
              {
                "color": "red",
                "value": null
              },
              {
                "color": "dark-red",
                "value": 200
              },
              {
                "color": "yellow",
                "value": 210
              },
              {
                "color": "green",
                "value": 220
              },
              {
                "color": "green",
                "value": 230
              },
              {
                "color": "#EAB839",
                "value": 240
              },
              {
                "color": "dark-red",
                "value": 250
              }
            ],
            "unit": "volt"
          },
          "override": {},
          "values": false
        },
        "orientation": "auto",
        "showThresholdLabels": true,
        "showThresholdMarkers": true
      },
      "pluginVersion": "6.3.5",
      "targets": [
        {
          "groupBy": [
            {
              "params": [
                "$interval"
              ],
              "type": "time"
            },
            {
              "params": [
                "previous"
              ],
              "type": "fill"
            }
          ],
          "measurement": "power",
          "orderByTime": "ASC",
          "policy": "default",
          "refId": "A",
          "resultFormat": "time_series",
          "select": [
            [
              {
                "params": [
                  "voltagePhase2"
                ],
                "type": "field"
              },
              {
                "params": [],
                "type": "last"
              }
            ]
          ],
          "tags": []
        }
      ],
      "timeFrom": null,
      "timeShift": null,
      "title": "Voltage - Phase 2",
      "type": "gauge"
    },
    {
      "gridPos": {
        "h": 5,
        "w": 4,
        "x": 8,
        "y": 0
      },
      "id": 8,
      "options": {
        "fieldOptions": {
          "calcs": [
            "lastNotNull"
          ],
          "defaults": {
            "mappings": [],
            "max": 260,
            "min": 200,
            "thresholds": [
              {
                "color": "red",
                "value": null
              },
              {
                "color": "dark-red",
                "value": 200
              },
              {
                "color": "yellow",
                "value": 210
              },
              {
                "color": "green",
                "value": 220
              },
              {
                "color": "green",
                "value": 230
              },
              {
                "color": "#EAB839",
                "value": 240
              },
              {
                "color": "dark-red",
                "value": 250
              }
            ],
            "unit": "volt"
          },
          "override": {},
          "values": false
        },
        "orientation": "auto",
        "showThresholdLabels": true,
        "showThresholdMarkers": true
      },
      "pluginVersion": "6.3.5",
      "targets": [
        {
          "groupBy": [
            {
              "params": [
                "$interval"
              ],
              "type": "time"
            },
            {
              "params": [
                "previous"
              ],
              "type": "fill"
            }
          ],
          "measurement": "power",
          "orderByTime": "ASC",
          "policy": "default",
          "refId": "A",
          "resultFormat": "time_series",
          "select": [
            [
              {
                "params": [
                  "voltagePhase3"
                ],
                "type": "field"
              },
              {
                "params": [],
                "type": "last"
              }
            ]
          ],
          "tags": []
        }
      ],
      "timeFrom": null,
      "timeShift": null,
      "title": "Voltage - Phase 3",
      "type": "gauge"
    },
    {
      "gridPos": {
        "h": 13,
        "w": 4,
        "x": 12,
        "y": 0
      },
      "id": 4,
      "interval": "",
      "options": {
        "displayMode": "lcd",
        "fieldOptions": {
          "calcs": [
            "lastNotNull"
          ],
          "defaults": {
            "decimals": 2,
            "mappings": [],
            "max": 50,
            "min": 0,
            "thresholds": [
              {
                "color": "green",
                "value": null
              },
              {
                "color": "yellow",
                "value": 25
              },
              {
                "color": "red",
                "value": 40
              }
            ],
            "title": "",
            "unit": "amp"
          },
          "override": {},
          "values": false
        },
        "orientation": "vertical"
      },
      "pluginVersion": "6.3.5",
      "targets": [
        {
          "alias": "Phase 1",
          "groupBy": [],
          "measurement": "power",
          "orderByTime": "ASC",
          "policy": "default",
          "refId": "A",
          "resultFormat": "time_series",
          "select": [
            [
              {
                "params": [
                  "currentL1"
                ],
                "type": "field"
              }
            ]
          ],
          "tags": []
        },
        {
          "alias": "Phase 2",
          "groupBy": [],
          "measurement": "power",
          "orderByTime": "ASC",
          "policy": "default",
          "refId": "B",
          "resultFormat": "time_series",
          "select": [
            [
              {
                "params": [
                  "currentL2"
                ],
                "type": "field"
              }
            ]
          ],
          "tags": []
        },
        {
          "alias": "Phase 3",
          "groupBy": [],
          "measurement": "power",
          "orderByTime": "ASC",
          "policy": "default",
          "refId": "C",
          "resultFormat": "time_series",
          "select": [
            [
              {
                "params": [
                  "currentL3"
                ],
                "type": "field"
              }
            ]
          ],
          "tags": []
        }
      ],
      "timeFrom": null,
      "timeShift": null,
      "title": "Phase current",
      "type": "bargauge"
    },
    {
      "cacheTimeout": null,
      "colorBackground": false,
      "colorPostfix": false,
      "colorPrefix": false,
      "colorValue": true,
      "colors": [
        "#299c46",
        "rgba(237, 129, 40, 0.89)",
        "#d44a3a"
      ],
      "format": "watt",
      "gauge": {
        "maxValue": 100,
        "minValue": 0,
        "show": false,
        "thresholdLabels": false,
        "thresholdMarkers": true
      },
      "gridPos": {
        "h": 4,
        "w": 4,
        "x": 16,
        "y": 0
      },
      "id": 10,
      "interval": null,
      "links": [],
      "mappingType": 1,
      "mappingTypes": [
        {
          "name": "value to text",
          "value": 1
        },
        {
          "name": "range to text",
          "value": 2
        }
      ],
      "maxDataPoints": 100,
      "nullPointMode": "connected",
      "nullText": null,
      "options": {},
      "pluginVersion": "6.3.5",
      "postfix": "",
      "postfixFontSize": "50%",
      "prefix": "",
      "prefixFontSize": "50%",
      "rangeMaps": [
        {
          "from": "null",
          "text": "N/A",
          "to": "null"
        }
      ],
      "sparkline": {
        "fillColor": "rgb(3, 94, 107)",
        "full": false,
        "lineColor": "rgb(31, 120, 193)",
        "show": false,
        "ymax": null,
        "ymin": null
      },
      "tableColumn": "",
      "targets": [
        {
          "groupBy": [
            {
              "params": [
                "$__interval"
              ],
              "type": "time"
            },
            {
              "params": [
                "null"
              ],
              "type": "fill"
            }
          ],
          "measurement": "power",
          "orderByTime": "ASC",
          "policy": "default",
          "refId": "A",
          "resultFormat": "time_series",
          "select": [
            [
              {
                "params": [
                  "power"
                ],
                "type": "field"
              },
              {
                "params": [],
                "type": "last"
              }
            ]
          ],
          "tags": []
        }
      ],
      "thresholds": "5000,10000",
      "timeFrom": null,
      "timeShift": null,
      "title": "Current power",
      "type": "singlestat",
      "valueFontSize": "100%",
      "valueMaps": [
        {
          "op": "=",
          "text": "N/A",
          "value": "null"
        }
      ],
      "valueName": "current"
    },
    {
      "cacheTimeout": null,
      "colorBackground": false,
      "colorValue": false,
      "colors": [
        "#299c46",
        "rgba(237, 129, 40, 0.89)",
        "#d44a3a"
      ],
      "decimals": 2,
      "format": "kwatth",
      "gauge": {
        "maxValue": 100,
        "minValue": 0,
        "show": false,
        "thresholdLabels": false,
        "thresholdMarkers": true
      },
      "gridPos": {
        "h": 4,
        "w": 4,
        "x": 20,
        "y": 0
      },
      "id": 17,
      "interval": null,
      "links": [],
      "mappingType": 1,
      "mappingTypes": [
        {
          "name": "value to text",
          "value": 1
        },
        {
          "name": "range to text",
          "value": 2
        }
      ],
      "maxDataPoints": 100,
      "nullPointMode": "connected",
      "nullText": null,
      "options": {},
      "postfix": "",
      "postfixFontSize": "50%",
      "prefix": "",
      "prefixFontSize": "50%",
      "rangeMaps": [
        {
          "from": "null",
          "text": "N/A",
          "to": "null"
        }
      ],
      "sparkline": {
        "fillColor": "rgba(31, 118, 189, 0.18)",
        "full": false,
        "lineColor": "rgb(31, 120, 193)",
        "show": false,
        "ymax": null,
        "ymin": null
      },
      "tableColumn": "",
      "targets": [
        {
          "groupBy": [
            {
              "params": [
                "$__interval"
              ],
              "type": "time"
            },
            {
              "params": [
                "null"
              ],
              "type": "fill"
            }
          ],
          "measurement": "power",
          "orderByTime": "ASC",
          "policy": "default",
          "refId": "A",
          "resultFormat": "time_series",
          "select": [
            [
              {
                "params": [
                  "accumulatedConsumption"
                ],
                "type": "field"
              },
              {
                "params": [],
                "type": "last"
              }
            ]
          ],
          "tags": []
        }
      ],
      "thresholds": "",
      "timeFrom": null,
      "timeShift": null,
      "title": "Consumption today",
      "type": "singlestat",
      "valueFontSize": "80%",
      "valueMaps": [
        {
          "op": "=",
          "text": "N/A",
          "value": "null"
        }
      ],
      "valueName": "current"
    },
    {
      "cacheTimeout": null,
      "colorBackground": false,
      "colorPostfix": false,
      "colorPrefix": false,
      "colorValue": true,
      "colors": [
        "#299c46",
        "rgba(237, 129, 40, 0.89)",
        "#d44a3a"
      ],
      "format": "watt",
      "gauge": {
        "maxValue": 100,
        "minValue": 0,
        "show": false,
        "thresholdLabels": false,
        "thresholdMarkers": true
      },
      "gridPos": {
        "h": 3,
        "w": 4,
        "x": 16,
        "y": 4
      },
      "id": 11,
      "interval": null,
      "links": [],
      "mappingType": 1,
      "mappingTypes": [
        {
          "name": "value to text",
          "value": 1
        },
        {
          "name": "range to text",
          "value": 2
        }
      ],
      "maxDataPoints": 100,
      "nullPointMode": "connected",
      "nullText": null,
      "options": {},
      "pluginVersion": "6.3.5",
      "postfix": "",
      "postfixFontSize": "50%",
      "prefix": "",
      "prefixFontSize": "50%",
      "rangeMaps": [
        {
          "from": "null",
          "text": "N/A",
          "to": "null"
        }
      ],
      "sparkline": {
        "fillColor": "rgb(3, 94, 107)",
        "full": false,
        "lineColor": "rgb(31, 120, 193)",
        "show": false,
        "ymax": null,
        "ymin": null
      },
      "tableColumn": "",
      "targets": [
        {
          "groupBy": [
            {
              "params": [
                "$__interval"
              ],
              "type": "time"
            },
            {
              "params": [
                "null"
              ],
              "type": "fill"
            }
          ],
          "measurement": "power",
          "orderByTime": "ASC",
          "policy": "default",
          "refId": "A",
          "resultFormat": "time_series",
          "select": [
            [
              {
                "params": [
                  "averagePower"
                ],
                "type": "field"
              },
              {
                "params": [],
                "type": "last"
              }
            ]
          ],
          "tags": []
        }
      ],
      "thresholds": "5000,10000",
      "timeFrom": null,
      "timeShift": null,
      "title": "Average power",
      "type": "singlestat",
      "valueFontSize": "80%",
      "valueMaps": [
        {
          "op": "=",
          "text": "N/A",
          "value": "null"
        }
      ],
      "valueName": "current"
    },
    {
      "cacheTimeout": null,
      "colorBackground": false,
      "colorValue": false,
      "colors": [
        "#299c46",
        "rgba(237, 129, 40, 0.89)",
        "#d44a3a"
      ],
      "decimals": 2,
      "format": "currencyNOK",
      "gauge": {
        "maxValue": 100,
        "minValue": 0,
        "show": false,
        "thresholdLabels": false,
        "thresholdMarkers": true
      },
      "gridPos": {
        "h": 3,
        "w": 4,
        "x": 20,
        "y": 4
      },
      "id": 20,
      "interval": null,
      "links": [],
      "mappingType": 1,
      "mappingTypes": [
        {
          "name": "value to text",
          "value": 1
        },
        {
          "name": "range to text",
          "value": 2
        }
      ],
      "maxDataPoints": 100,
      "nullPointMode": "connected",
      "nullText": null,
      "options": {},
      "postfix": "",
      "postfixFontSize": "50%",
      "prefix": "",
      "prefixFontSize": "50%",
      "rangeMaps": [
        {
          "from": "null",
          "text": "N/A",
          "to": "null"
        }
      ],
      "sparkline": {
        "fillColor": "rgba(31, 118, 189, 0.18)",
        "full": false,
        "lineColor": "rgb(31, 120, 193)",
        "show": false,
        "ymax": null,
        "ymin": null
      },
      "tableColumn": "",
      "targets": [
        {
          "groupBy": [
            {
              "params": [
                "$__interval"
              ],
              "type": "time"
            },
            {
              "params": [
                "previous"
              ],
              "type": "fill"
            }
          ],
          "measurement": "energy",
          "orderByTime": "ASC",
          "policy": "default",
          "query": "SELECT last(\"total\") + (41.91 / 100) + ((287.5 / 30.5) / 24) FROM \"energy\" WHERE $timeFilter GROUP BY time($__interval) fill(previous)\n-- Nettleie: 41.91 øre/KWh\n-- Månedlig fastpris: 287,50",
          "rawQuery": true,
          "refId": "A",
          "resultFormat": "time_series",
          "select": [
            [
              {
                "params": [
                  "total"
                ],
                "type": "field"
              },
              {
                "params": [],
                "type": "mean"
              }
            ]
          ],
          "tags": []
        }
      ],
      "thresholds": "",
      "timeFrom": null,
      "timeShift": null,
      "title": "Current price / KWh",
      "type": "singlestat",
      "valueFontSize": "80%",
      "valueMaps": [
        {
          "op": "=",
          "text": "N/A",
          "value": "null"
        }
      ],
      "valueName": "current"
    },
    {
      "aliasColors": {},
      "bars": false,
      "dashLength": 10,
      "dashes": false,
      "decimals": 2,
      "description": "",
      "fill": 1,
      "fillGradient": 4,
      "gridPos": {
        "h": 8,
        "w": 12,
        "x": 0,
        "y": 5
      },
      "id": 2,
      "interval": "",
      "legend": {
        "alignAsTable": false,
        "avg": false,
        "current": true,
        "hideEmpty": false,
        "hideZero": false,
        "max": false,
        "min": false,
        "rightSide": false,
        "show": true,
        "total": false,
        "values": true
      },
      "lines": true,
      "linewidth": 1,
      "nullPointMode": "connected",
      "options": {
        "dataLinks": []
      },
      "percentage": false,
      "pointradius": 2,
      "points": false,
      "renderer": "flot",
      "seriesOverrides": [
        {
          "alias": "Power",
          "yaxis": 2
        },
        {
          "alias": "Price",
          "yaxis": 1
        }
      ],
      "spaceLength": 10,
      "stack": false,
      "steppedLine": false,
      "targets": [
        {
          "alias": "Power",
          "groupBy": [
            {
              "params": [
                "$__interval"
              ],
              "type": "time"
            },
            {
              "params": [
                "linear"
              ],
              "type": "fill"
            }
          ],
          "hide": false,
          "measurement": "power",
          "orderByTime": "ASC",
          "policy": "default",
          "refId": "A",
          "resultFormat": "time_series",
          "select": [
            [
              {
                "params": [
                  "power"
                ],
                "type": "field"
              },
              {
                "params": [],
                "type": "last"
              }
            ]
          ],
          "tags": []
        },
        {
          "alias": "Price",
          "groupBy": [
            {
              "params": [
                "$__interval"
              ],
              "type": "time"
            },
            {
              "params": [
                "previous"
              ],
              "type": "fill"
            }
          ],
          "measurement": "energy",
          "orderByTime": "ASC",
          "policy": "default",
          "refId": "B",
          "resultFormat": "time_series",
          "select": [
            [
              {
                "params": [
                  "total"
                ],
                "type": "field"
              },
              {
                "params": [],
                "type": "mean"
              }
            ]
          ],
          "tags": []
        }
      ],
      "thresholds": [],
      "timeFrom": null,
      "timeRegions": [],
      "timeShift": null,
      "title": "Power consumprion",
      "tooltip": {
        "shared": true,
        "sort": 0,
        "value_type": "individual"
      },
      "type": "graph",
      "xaxis": {
        "buckets": null,
        "mode": "time",
        "name": null,
        "show": true,
        "values": []
      },
      "yaxes": [
        {
          "format": "currencyNOK",
          "label": "Price",
          "logBase": 1,
          "max": null,
          "min": null,
          "show": true
        },
        {
          "decimals": null,
          "format": "watt",
          "label": "Energy",
          "logBase": 1,
          "max": null,
          "min": null,
          "show": true
        }
      ],
      "yaxis": {
        "align": false,
        "alignLevel": null
      }
    },
    {
      "cacheTimeout": null,
      "colorBackground": false,
      "colorPostfix": false,
      "colorPrefix": false,
      "colorValue": true,
      "colors": [
        "#299c46",
        "rgba(237, 129, 40, 0.89)",
        "#d44a3a"
      ],
      "format": "watt",
      "gauge": {
        "maxValue": 100,
        "minValue": 0,
        "show": false,
        "thresholdLabels": false,
        "thresholdMarkers": true
      },
      "gridPos": {
        "h": 3,
        "w": 4,
        "x": 16,
        "y": 7
      },
      "id": 12,
      "interval": null,
      "links": [],
      "mappingType": 1,
      "mappingTypes": [
        {
          "name": "value to text",
          "value": 1
        },
        {
          "name": "range to text",
          "value": 2
        }
      ],
      "maxDataPoints": 100,
      "nullPointMode": "connected",
      "nullText": null,
      "options": {},
      "pluginVersion": "6.3.5",
      "postfix": "",
      "postfixFontSize": "50%",
      "prefix": "",
      "prefixFontSize": "50%",
      "rangeMaps": [
        {
          "from": "null",
          "text": "N/A",
          "to": "null"
        }
      ],
      "sparkline": {
        "fillColor": "rgb(3, 94, 107)",
        "full": false,
        "lineColor": "rgb(31, 120, 193)",
        "show": false,
        "ymax": null,
        "ymin": null
      },
      "tableColumn": "",
      "targets": [
        {
          "groupBy": [
            {
              "params": [
                "$__interval"
              ],
              "type": "time"
            },
            {
              "params": [
                "null"
              ],
              "type": "fill"
            }
          ],
          "measurement": "power",
          "orderByTime": "ASC",
          "policy": "default",
          "refId": "A",
          "resultFormat": "time_series",
          "select": [
            [
              {
                "params": [
                  "minPower"
                ],
                "type": "field"
              },
              {
                "params": [],
                "type": "last"
              }
            ]
          ],
          "tags": []
        }
      ],
      "thresholds": "5000,10000",
      "timeFrom": null,
      "timeShift": null,
      "title": "Minimum power",
      "type": "singlestat",
      "valueFontSize": "80%",
      "valueMaps": [
        {
          "op": "=",
          "text": "N/A",
          "value": "null"
        }
      ],
      "valueName": "current"
    },
    {
      "cacheTimeout": null,
      "colorBackground": false,
      "colorPostfix": false,
      "colorPrefix": true,
      "colorValue": false,
      "colors": [
        "#299c46",
        "rgba(237, 129, 40, 0.89)",
        "#d44a3a"
      ],
      "decimals": 2,
      "format": "currencyNOK",
      "gauge": {
        "maxValue": 100,
        "minValue": 0,
        "show": false,
        "thresholdLabels": false,
        "thresholdMarkers": true
      },
      "gridPos": {
        "h": 3,
        "w": 4,
        "x": 20,
        "y": 7
      },
      "id": 15,
      "interval": null,
      "links": [],
      "mappingType": 1,
      "mappingTypes": [
        {
          "name": "value to text",
          "value": 1
        },
        {
          "name": "range to text",
          "value": 2
        }
      ],
      "maxDataPoints": 100,
      "nullPointMode": "connected",
      "nullText": null,
      "options": {},
      "pluginVersion": "6.3.5",
      "postfix": "",
      "postfixFontSize": "50%",
      "prefix": "",
      "prefixFontSize": "50%",
      "rangeMaps": [
        {
          "from": "null",
          "text": "N/A",
          "to": "null"
        }
      ],
      "sparkline": {
        "fillColor": "rgba(31, 118, 189, 0.18)",
        "full": false,
        "lineColor": "rgb(31, 120, 193)",
        "show": false,
        "ymax": null,
        "ymin": null
      },
      "tableColumn": "",
      "targets": [
        {
          "groupBy": [
            {
              "params": [
                "$interval"
              ],
              "type": "time"
            }
          ],
          "measurement": "power",
          "orderByTime": "ASC",
          "policy": "default",
          "refId": "A",
          "resultFormat": "time_series",
          "select": [
            [
              {
                "params": [
                  "accumulatedCost"
                ],
                "type": "field"
              },
              {
                "params": [],
                "type": "last"
              }
            ]
          ],
          "tags": []
        }
      ],
      "thresholds": "",
      "timeFrom": null,
      "timeShift": null,
      "title": "Net cost today",
      "type": "singlestat",
      "valueFontSize": "80%",
      "valueMaps": [
        {
          "op": "=",
          "text": "N/A",
          "value": "null"
        }
      ],
      "valueName": "current"
    },
    {
      "cacheTimeout": null,
      "colorBackground": false,
      "colorPostfix": false,
      "colorPrefix": false,
      "colorValue": true,
      "colors": [
        "#299c46",
        "rgba(237, 129, 40, 0.89)",
        "#d44a3a"
      ],
      "format": "watt",
      "gauge": {
        "maxValue": 100,
        "minValue": 0,
        "show": false,
        "thresholdLabels": false,
        "thresholdMarkers": true
      },
      "gridPos": {
        "h": 3,
        "w": 4,
        "x": 16,
        "y": 10
      },
      "id": 13,
      "interval": null,
      "links": [],
      "mappingType": 1,
      "mappingTypes": [
        {
          "name": "value to text",
          "value": 1
        },
        {
          "name": "range to text",
          "value": 2
        }
      ],
      "maxDataPoints": 100,
      "nullPointMode": "connected",
      "nullText": null,
      "options": {},
      "pluginVersion": "6.3.5",
      "postfix": "",
      "postfixFontSize": "50%",
      "prefix": "",
      "prefixFontSize": "50%",
      "rangeMaps": [
        {
          "from": "null",
          "text": "N/A",
          "to": "null"
        }
      ],
      "sparkline": {
        "fillColor": "rgb(3, 94, 107)",
        "full": false,
        "lineColor": "rgb(31, 120, 193)",
        "show": false,
        "ymax": null,
        "ymin": null
      },
      "tableColumn": "",
      "targets": [
        {
          "groupBy": [
            {
              "params": [
                "$__interval"
              ],
              "type": "time"
            },
            {
              "params": [
                "null"
              ],
              "type": "fill"
            }
          ],
          "measurement": "power",
          "orderByTime": "ASC",
          "policy": "default",
          "refId": "A",
          "resultFormat": "time_series",
          "select": [
            [
              {
                "params": [
                  "maxPower"
                ],
                "type": "field"
              },
              {
                "params": [],
                "type": "last"
              }
            ]
          ],
          "tags": []
        }
      ],
      "thresholds": "5000,10000",
      "timeFrom": null,
      "timeShift": null,
      "title": "Maximum power",
      "type": "singlestat",
      "valueFontSize": "80%",
      "valueMaps": [
        {
          "op": "=",
          "text": "N/A",
          "value": "null"
        }
      ],
      "valueName": "current"
    },
    {
      "cacheTimeout": null,
      "colorBackground": false,
      "colorPostfix": false,
      "colorPrefix": false,
      "colorValue": false,
      "colors": [
        "#299c46",
        "rgba(237, 129, 40, 0.89)",
        "#d44a3a"
      ],
      "decimals": 2,
      "format": "currencyNOK",
      "gauge": {
        "maxValue": 100,
        "minValue": 0,
        "show": false,
        "thresholdLabels": false,
        "thresholdMarkers": true
      },
      "gridPos": {
        "h": 3,
        "w": 4,
        "x": 20,
        "y": 10
      },
      "id": 18,
      "interval": null,
      "links": [],
      "mappingType": 1,
      "mappingTypes": [
        {
          "name": "value to text",
          "value": 1
        },
        {
          "name": "range to text",
          "value": 2
        }
      ],
      "maxDataPoints": 100,
      "nullPointMode": "connected",
      "nullText": null,
      "options": {},
      "pluginVersion": "6.3.5",
      "postfix": "",
      "postfixFontSize": "50%",
      "prefix": "",
      "prefixFontSize": "50%",
      "rangeMaps": [
        {
          "from": "null",
          "text": "N/A",
          "to": "null"
        }
      ],
      "sparkline": {
        "fillColor": "rgba(31, 118, 189, 0.18)",
        "full": false,
        "lineColor": "rgb(31, 120, 193)",
        "show": false,
        "ymax": null,
        "ymin": null
      },
      "tableColumn": "",
      "targets": [
        {
          "groupBy": [
            {
              "params": [
                "$interval"
              ],
              "type": "time"
            }
          ],
          "measurement": "power",
          "orderByTime": "ASC",
          "policy": "default",
          "query": "SELECT last(\"accumulatedCost\") + (last(\"accumulatedConsumption\") * (41.91 / 100)) + ((287.5 / 30.5) / 24) FROM \"power\" WHERE $timeFilter GROUP BY time($interval)",
          "rawQuery": true,
          "refId": "A",
          "resultFormat": "time_series",
          "select": [
            [
              {
                "params": [
                  "accumulatedConsumption"
                ],
                "type": "field"
              },
              {
                "params": [],
                "type": "last"
              },
              {
                "params": [
                  "+0.4191+9.5"
                ],
                "type": "math"
              }
            ]
          ],
          "tags": []
        }
      ],
      "thresholds": "",
      "timeFrom": null,
      "timeShift": null,
      "title": "Total cost today",
      "type": "singlestat",
      "valueFontSize": "80%",
      "valueMaps": [
        {
          "op": "=",
          "text": "N/A",
          "value": "null"
        }
      ],
      "valueName": "current"
    }
  ],
  "refresh": "10s",
  "schemaVersion": 19,
  "style": "dark",
  "tags": [],
  "templating": {
    "list": []
  },
  "time": {
    "from": "now-24h",
    "to": "now"
  },
  "timepicker": {
    "refresh_intervals": [
      "5s",
      "10s",
      "30s",
      "1m",
      "5m",
      "15m",
      "30m",
      "1h",
      "2h",
      "1d"
    ]
  },
  "timezone": "",
  "title": "Power",
  "uid": "JdFnx-cZk",
  "version": 33
}
```

</p></details>

## License

[MIT](https://choosealicense.com/licenses/mit/)
