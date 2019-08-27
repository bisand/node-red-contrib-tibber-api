const { request } = require('graphql-request');
const { GraphQLClient } = require('graphql-request');

class TibberQuery {
    constructor(config) {
        var node = this;
        node._config = config;
        node.active = false;
        node.client = new GraphQLClient(config.apiUrl, {
            headers: {
                authorization: 'Bearer ' + config.apiToken,
            },
        });
    }

    async query(query) {
        return await node.client(query);
    }
}

module.exports = TibberQuery;
