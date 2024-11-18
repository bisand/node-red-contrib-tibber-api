import { version } from '../Version';
import { NodeAPI, Node, NodeDef } from 'node-red';

interface TibberApiEndpointNodeDef extends NodeDef {
    queryUrl: string;
    feedTimeout: number;
    feedConnectionTimeout: number;
    queryRequestTimeout: number;
    apiKey?: string;
}

interface TibberApiEndpointNodeCredentials {
    accessToken: string;
}

class TibberApiEndpointNode {
    private queryUrl: string;
    private feedTimeout: number;
    private feedConnectionTimeout: number;
    private queryRequestTimeout: number;
    private userAgent: string;

    constructor(config: TibberApiEndpointNodeDef, private RED: NodeAPI, private node: Node) {
        this.RED.nodes.createNode(this.node, config);

        const credentials = this.node.credentials as TibberApiEndpointNodeCredentials;
        if (credentials && !credentials.accessToken && config.apiKey) {
            this.RED.nodes.addCredentials(this.node.id, { accessToken: config.apiKey });
        }

        // delete properties, just in case.
        delete config.apiKey;

        this.queryUrl = config.queryUrl;
        this.feedTimeout = config.feedTimeout;
        this.feedConnectionTimeout = config.feedConnectionTimeout;
        this.queryRequestTimeout = config.queryRequestTimeout;
        this.userAgent = `bisand/node-red-contrib-tibber-api/${version}`;

        this.node.on('close', (removed: boolean, done: () => void) => {
            // Perform cleanup here
            done();
        });
    }
}

module.exports = function (RED: NodeAPI) {
    RED.nodes.registerType('tibber-api-endpoint', function (config: TibberApiEndpointNodeDef) {
        new TibberApiEndpointNode(config, RED, this);
    }, {
        credentials: {
            accessToken: {
                type: 'text',
            },
        },
    });
};