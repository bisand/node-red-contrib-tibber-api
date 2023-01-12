const TibberQuery = require("tibber-api").TibberQuery;

module.exports = function (RED) {
  function TibberMeeterNode(config) {
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
      var homeId = this._config.homeId
        ? this._config.homeId
        : msg.payload.homeId;
      var time = this._config.time
        ? this._config.time
        : msg.payload.time;
      var reading = this._config.reading
        ? this._config.reading
        : msg.payload.reading;

      if (!homeId || !time || !reading) {
        this.error("Missing mandatory parameters (homeId, time and/or reading)");
        return;
      }

      var query =
        'mutation{sendMeterReading(input: {homeId: "' +
        homeId +
        '", time: "' +
        time +
        '", reading: ' +
        reading +
        "}){homeId time reading}}";
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

  RED.nodes.registerType("tibber-meter", TibberMeeterNode);
};
