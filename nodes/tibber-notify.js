const TibberQuery = require("tibber-api").TibberQuery;

module.exports = function (RED) {
  function TibberNotifyNode(config) {
    RED.nodes.createNode(this, config);
    config.apiEndpoint = RED.nodes.getNode(config.apiEndpointRef);
    this._config = config;

    var credentials = RED.nodes.getCredentials(config.apiEndpointRef);
    if (!config.apiEndpoint.queryUrl || !credentials || !credentials.accessToken) {
      this.error("Missing mandatory parameters (queryUrl and/or accessToken)");
      return;
    }

    // Assign access token to api key to meintain compatibility. This will not cause the access token to be exported.
    config.apiEndpoint.apiKey = credentials.accessToken;
    this.client = new TibberQuery(config);

    this.on("input", async (msg) => {
      var title = this._config.notifyTitle
        ? this._config.notifyTitle
        : msg.payload.title;
      var message = this._config.notifyMessage
        ? this._config.notifyMessage
        : msg.payload.message;
      var screen = this._config.notifyScreen
        ? this._config.notifyScreen
        : msg.payload.screen;
      screen = screen ? screen : "HOME";

      if (!title || !message) {
        this.error("Missing mandatory parameters (title and/or message)");
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
        var result = await this.client.query(query);
        if (result.error) {
          this.error(JSON.stringify(result));
        } else {
          this.log(JSON.stringify(result));
        }
      } catch (error) {
        this.error(error);
      }
    });
  }

  RED.nodes.registerType("tibber-notify", TibberNotifyNode);
};
