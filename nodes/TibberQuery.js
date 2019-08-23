const { request } = require('graphql-request')
const { GraphQLClient }  = require('graphql-request');

class TibberQuery {
    constructor(config) {
        var self = this;
        request();
        self.client = new GraphQLClient();

    }
}
