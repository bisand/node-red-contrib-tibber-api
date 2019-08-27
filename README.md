# node-red-contrib-tibber-api

Node Red module for integrating with Tibber api.

|  Branch  | Status           |
|----------|------------------|
|develop   | [![Build Status](https://travis-ci.org/bisand/node-red-contrib-tibber-api.svg?branch=develop)](https://travis-ci.org/bisand/node-red-contrib-tibber-api) |
| master | [![Build Status](https://travis-ci.org/bisand/node-red-contrib-tibber-api.svg?branch=master)](https://travis-ci.org/bisand/node-red-contrib-tibber-api) |
 
### General
This Node-Red module is used for communication with Tipper API.

### Prerequisites
You will need an API token. Register here: https://developer.tibber.com/

### Installation
NPM package: https://www.npmjs.com/package/node-red-contrib-tibber-api

Manual installation
```bash
npm install node-red-contrib-tibber-api
```

### Tibber Feed node
Realtime power consuption data from Tibber Pulse. Provide API token, Home ID and select what kind of information you want to retrieve.

### Tibber API call node
Do basic calls to Tibber API using GraphQL queries. See Tibber API documentation and API Explorer for more informations.
