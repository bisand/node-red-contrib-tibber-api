module.exports = function(RED) {
  function TibberApiEndpointNode(n) {
    RED.nodes.createNode(this, n);
    this.host = n.host;
    this.port = n.port;
  }
  RED.nodes.registerType("tibber-api-endpoint", TibberApiEndpointNode);
};
