

module.exports = function (RED) {
    function tibberApiNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        var intervalId = setInterval(myTimer, 1000);

        node.on('input', function (msg) {
            msg.payload = { apikey: config.apikey, homeid: config.homeid };
            node.send(msg);
        });
        node.on('close', function () {
            clearInterval(intervalId);
        });

        function myTimer() {
            var d = new Date();
            var t = d.toLocaleTimeString();
            var msg = { payload: { time: t } };
            node.send(msg)
        }
    }
    RED.nodes.registerType("tibber-api", tibberApiNode);
}
