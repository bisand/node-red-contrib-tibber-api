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

### Tibber Feed node (tibber-feed)
Realtime power consuption data from Tibber Pulse. Provide API token, Home ID and select what kind of information you want to retrieve.
![tibber-feed](http://url/to/img.png)

### Tibber API call node (tibber-query)
Do basic calls to Tibber API using GraphQL queries. See Tibber API documentation and API Explorer for more informations.
![tibber-query](http://url/to/img.png)

### Tibber push notification (tibber-notify)
Send push nofifications to connected TIbber apps via Tibber API using GraphQL queries. Fill in Title, Message and which screen to open in the app directly in the node, or by providing the data via the incomming .
![tibber-notify](http://url/to/img.png)

## License
[MIT](https://choosealicense.com/licenses/mit/)
