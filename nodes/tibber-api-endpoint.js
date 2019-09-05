module.exports = function (RED) {
  function TibberApiEndpointNode(config) {
    RED.nodes.createNode(this, config);
    this.feedUrl = config.feedUrl;
    this.queryUrl = config.queryUrl;
    this.apiKey = config.apiKey;
  }
  RED.nodes.registerType("tibber-api-endpoint", TibberApiEndpointNode);
};
