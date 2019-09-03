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

## License
[MIT](https://choosealicense.com/licenses/mit/)
