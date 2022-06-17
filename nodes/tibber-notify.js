const TibberQuery = require("tibber-api").TibberQuery;

module.exports = function (RED) {
  function TibberNotifyNode(config) {
    RED.nodes.createNode(this, config);
    var node = this;
    config.apiEndpoint = RED.nodes.getNode(config.apiEndpointRef);
    node._config = config;

    var credentials = RED.nodes.getCredentials(config.apiEndpointRef);
    if (!config.apiEndpoint.queryUrl || !credentials || !credentials.accessToken) {
      node.error("Missing mandatory parameters (queryUrl and/or accessToken)");
      return;
    }

    // Assign access token to api key to meintain compatibility. This will not cause the access token to be exported.
    config.apiEndpoint.apiKey = credentials.accessToken;
    node.client = new TibberQuery(config);

    node.on("input", async function (msg) {
      var title = node._config.notifyTitle
        ? node._config.notifyTitle
        : msg.payload.title;
      var message = node._config.notifyMessage
        ? node._config.notifyMessage
        : msg.payload.message;
      var screen = node._config.notifyScreen
        ? node._config.notifyScreen
        : msg.payload.screen;
      screen = screen ? screen : "HOME";

      if (!title || !message) {
        node.error("Missing mandatory parameters (title and/or message)");
        return;
      }

      var query =
        'mutation{sendPushNotification(input: {title: "' +
        title +
        '", message: "' +
        message +
        '", screenToOpen: ' +
        screen +
        "}){successful pushedToNumberOfDevices}}";
      try {
        var result = await node.client.query(query);
        if (result.error) {
          node.error(JSON.stringify(result));
        } else {
          node.log(JSON.stringify(result));
        }
      } catch (error) {
        node.error(error);
      }
    });
  }

  RED.nodes.registerType("tibber-notify", TibberNotifyNode);
};
