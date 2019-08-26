const { request } = require('graphql-request');
const { GraphQLClient }  = require('graphql-request');

class TibberQuery {
    constructor(config) {
        var node = this;
        node._config = config;
        node.active = false;
        //request();
        //node.client = new GraphQLClient();

    }
}

module.exports = TibberQuery;
