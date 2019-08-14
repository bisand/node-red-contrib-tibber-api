

module.exports = function (RED) {
    function tibberApiNode(config) {
        RED.nodes.createNode(this, config);
        var msg = { payload: { test: "Started Tibber Test" } };
        var node = this;
        node.send(msg);
        node.on('input', function (msg) {
            msg.payload = { apikey: config.apikey, homeid: config.homeid };
            node.send(msg);
        });
    }
    RED.nodes.registerType("tibber-api", tibberApiNode);
}