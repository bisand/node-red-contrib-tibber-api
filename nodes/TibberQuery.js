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
        try {
            return await this.client.request(query);
        } catch (error) {
            return { error: error };
        }
    }
}

module.exports = TibberQuery;
