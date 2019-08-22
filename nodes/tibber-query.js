module.exports = function (RED) {
    function TibberQueryNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        if (!config.apiUrl || !config.apikey) {
            node.error('Missing mandatory parameters');
            return;
        }

    }

    RED.nodes.registerType("tibber-query", TibberQueryNode);
};
