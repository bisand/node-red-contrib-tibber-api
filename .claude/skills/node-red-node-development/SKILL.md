---
name: node-red-node-development
description: Working knowledge of Node-RED custom node development — registerType, node/HTML file structure, config nodes, credentials, status, edit dialogs, oneditprepare, packaging and node naming conventions. Use when developing or debugging Node-RED nodes in this package.
---

# Node-RED Custom Node Development

Condensed from the official Node-RED "Creating Nodes" docs (https://nodered.org/docs/creating-nodes/). A practical reference for maintaining `node-red-contrib-tibber-api`.

## Anatomy of a node

Every node type consists of a pair of files, registered in `package.json`:

- **A `.js` file** — the runtime behaviour, loaded by the Node-RED server.
- **A `.html` file** — everything the editor needs: node registration, the edit dialog template, and help text.

Design principles: a node should be well-defined and focused (start / middle / end of a flow, not all three), hide API complexity, be forgiving in what message types it accepts, be consistent in what it sends, and catch errors (uncaught exceptions or unhandled async rejections can take down the whole runtime).

## The JavaScript file

Canonical pattern:

```javascript
module.exports = function(RED) {
    function SampleNode(config) {
        RED.nodes.createNode(this, config);   // must be first
        var node = this;
        // copy editable properties from config
        node.prefix = config.prefix;

        node.on('input', function(msg, send, done) {
            // Node-RED 1.0+ style; keep 0.x fallbacks if needed:
            send = send || function() { node.send.apply(node, arguments); };
            try {
                msg.payload = node.prefix + String(msg.payload).toLowerCase();
                send(msg);
                if (done) done();
            } catch (err) {
                if (done) done(err);          // triggers Catch nodes on the tab
                else node.error(err, msg);    // 0.x fallback, also triggers Catch
            }
        });

        node.on('close', function(removed, done) {
            // tidy up: close connections, clear timers, stop polling
            if (removed) {
                // node was deleted/disabled
            } else {
                // node is being restarted (redeploy)
            }
            done();  // runtime times out the close after 15 seconds
        });
    }
    RED.nodes.registerType("sample", SampleNode);
};
```

Key points:

- The module exports a single function receiving the `RED` runtime API. Node-RED calls it when loading the node.
- `RED.nodes.createNode(this, config)` initialises base node features (credentials, events, etc.) and must be called in the constructor.
- **Receiving messages**: `node.on('input', function(msg, send, done) { ... })`. Since Node-RED 1.0 the listener gets `send` and `done`; use them so the runtime can correlate messages (complete/catch nodes, timeouts).
- **Sending messages**:
  - `node.send(msg)` — single message on the first output.
  - `node.send([msg1, msg2])` — one message to each output (multiple outputs).
  - `node.send([[msgA1, msgA2, msgA3], msg2])` — multiple messages on output 1, one on output 2.
  - Async work: complete the operation, then `send(...)` and `done()` from inside the callback/promise. For nodes that emit spontaneously (websocket feeds, timers — like the Tibber feed node), call `node.send(msg)` at any time; there is no `done` outside an input handler.
- **Errors**: `done(err)` (preferred, 1.0+) or `node.error("message", msg)` — passing the `msg` as the second argument is what makes the error catchable by a Catch node. `node.error("msg")` without the message object only logs.
- **Logging**: `node.log()`, `node.warn()`, `node.error()`; plus `node.trace()` and `node.debug()` for detail levels.
- **Close cleanup**: signatures `function()`, `function(done)` (async), or `function(removed, done)`. Always release sockets/intervals here, or redeploys leak.

### Node status

```javascript
node.status({fill:"red", shape:"ring", text:"disconnected"});
node.status({fill:"green", shape:"dot", text:"connected"});
node.status({});   // empty object clears the status
```

- `fill`: `red`, `green`, `yellow`, `blue`, `grey`
- `shape`: `ring` or `dot`
- `text`: short (< 20 chars). Can be an i18n key like `"node-red:common.status.connected"`.
- A Status node in a flow can catch status updates (useful for connect/disconnect handling flows).

### Node context

Nodes can store state via `this.context()` (node scope), `this.context().flow` and `this.context().global`, with `get`/`set`. Prefer instance fields for simple in-memory state; context matters when persistence stores are configured.

## The HTML file

Three script tags, all keyed to the same type name:

```html
<!-- 1. Node definition (runs in the editor) -->
<script type="text/javascript">
    RED.nodes.registerType('sample', {
        category: 'function',          // palette category
        color: '#a6bbcf',
        defaults: {
            name:   { value: "" },
            prefix: { value: "", required: true },
            port:   { value: 1234, validate: RED.validators.number() },
            server: { value: "", type: "remote-server" }   // config node pointer
        },
        credentials: {
            username: { type: "text" },
            password: { type: "password" }
        },
        inputs: 1,
        outputs: 1,
        icon: "file.svg",              // or "font-awesome/fa-bolt"
        align: 'right',                // for end-of-flow nodes
        paletteLabel: "sample",
        label: function() { return this.name || "sample"; },
        labelStyle: function() { return this.name ? "node_label_italic" : ""; },
        inputLabels: "trigger",
        outputLabels: ["result"],
        oneditprepare: function() { /* dialog opened */ },
        oneditsave:    function() { /* dialog OK'd     */ },
        oneditcancel:  function() { /* dialog cancelled */ }
    });
</script>

<!-- 2. Edit dialog template -->
<script type="text/html" data-template-name="sample">
    <div class="form-row">
        <label for="node-input-name"><i class="fa fa-tag"></i> Name</label>
        <input type="text" id="node-input-name" placeholder="Name">
    </div>
    <div class="form-row">
        <label for="node-input-prefix"><i class="fa fa-tag"></i> Prefix</label>
        <input type="text" id="node-input-prefix">
    </div>
</script>

<!-- 3. Help text (shown in the info sidebar) -->
<script type="text/html" data-help-name="sample">
    <p>Short summary — the first &lt;p&gt; is the palette hover tooltip.</p>
    <h3>Inputs</h3>
    <dl class="message-properties">
        <dt>payload <span class="property-type">string</span></dt>
        <dd>the text to process.</dd>
    </dl>
    <h3>Outputs</h3>
    <dl class="message-properties">
        <dt>payload <span class="property-type">string</span></dt>
        <dd>the processed text.</dd>
    </dl>
</script>
```

### Properties (`defaults`)

- Each entry: `value` (default), `required` (non-null/non-blank), `validate` (function or `RED.validators.number()` / `RED.validators.regex(re)`), `type` (config node type for pointer properties).
- **Reserved names** — never use as property names: `id`, `type`, `wires`, `inputs`, `outputs` (unless outputs is genuinely configurable), or single chars `x`, `y`, `z`, `d`, `g`, `l`.
- Values are passed to the runtime constructor as `config.<name>`; copy the ones you need onto `this`.
- A `name` property is conventional so users can distinguish instances.

### Edit dialog conventions

- Input IDs must be `node-input-<propertyname>` (regular nodes) or `node-config-input-<propertyname>` (config nodes). The editor auto-populates and auto-saves matching inputs — no code needed for plain text/checkbox/select fields.
- `oneditprepare` — initialise custom widgets (TypedInput, editors) after the dialog DOM exists.
- `oneditsave` / `oneditcancel` — persist non-standard values and destroy editors (`editor.destroy()`).
- TypedInput widget for multi-type values:

```javascript
oneditprepare: function() {
    $("#node-input-example1").typedInput({
        type: "str",
        types: ["str","num","bool"],
        typeField: "#node-input-example1-type"   // hidden input storing the type
    });
}
```

- Buttons: `<button type="button" class="red-ui-button">…</button>` (add `red-ui-button-small` for small).
- Keep the look consistent with core nodes; Font Awesome 4.7 icons are available in labels (`<i class="fa fa-tag"></i>`).

### Appearance

- `icon`: stock icons (`file.svg`, `inject.svg`, `db.svg`, `feed.svg`, `bridge.svg`, …), custom icons from an `icons/` directory next to the node files (white on transparent, 2:3 ratio, min 40x60px), or `"font-awesome/fa-<name>"`.
- `color`: common palette colors: `#3FADB5`, `#87A980`, `#A6BBCF`, `#C0DEED`, `#E9967A`, `#FFCC66`, `#FFFFFF`.
- `align: 'right'` for terminal nodes; `button: { onclick, enabled, visible, toggle }` for inject/debug-style buttons.
- Label functions cannot use credential properties.

## Config nodes

For shared configuration (e.g. the Tibber API endpoint/token shared by all tibber nodes).

Definition — `category: 'config'`, usually no inputs/outputs:

```javascript
// remote-server.js
module.exports = function(RED) {
    function RemoteServerNode(n) {
        RED.nodes.createNode(this, n);
        this.host = n.host;
        this.port = n.port;
    }
    RED.nodes.registerType("remote-server", RemoteServerNode);
};
```

```html
<script type="text/javascript">
    RED.nodes.registerType('remote-server', {
        category: 'config',
        defaults: {
            host: { value: "localhost", required: true },
            port: { value: 1234, required: true, validate: RED.validators.number() }
        },
        label: function() { return this.host + ":" + this.port; }
    });
</script>
<!-- template inputs use node-config-input-<prop> ids -->
```

Consuming node — declare the pointer in `defaults` and resolve at runtime:

```javascript
// In HTML defaults:
//   server: { value: "", type: "remote-server" }
// The editor renders this as a config-node select box automatically.

function MyNode(config) {
    RED.nodes.createNode(this, config);
    this.server = RED.nodes.getNode(config.server);  // config node instance or null
    if (this.server) {
        // use this.server.host, this.server.port, this.server.credentials...
    } else {
        // no config node selected — degrade gracefully
    }
}
```

Config nodes are scoped globally by default — state (connections, feeds) is shared between flows. This makes them the right place to own a shared connection that regular nodes subscribe to.

## Credentials

Declared on **both** sides of registerType:

```javascript
// .js — third argument to registerType
RED.nodes.registerType("my-node", MyNode, {
    credentials: {
        username: { type: "text" },
        password: { type: "password" }    // e.g. the Tibber access token
    }
});

// runtime access
var username = this.credentials.username;
var password = this.credentials.password;
```

```html
<!-- HTML: same credentials object in the editor definition,
     inputs use the normal node-input-<name> ids -->
<input type="text" id="node-input-username">
<input type="password" id="node-input-password">
```

How they behave:

- Stored **separately from the flow file** (encrypted credentials file) and **excluded from flow exports** — never put secrets in `defaults`.
- In the editor, `text` credentials are readable via `this.credentials.username`; `password` credentials are **not** sent to the editor — only a boolean `this.credentials.has_password` indicates one is set.
- Advanced: the runtime can store credentials the user never typed (e.g. OAuth tokens), by writing to the node's credential store.

## Packaging and publishing

`package.json` essentials:

```json
{
    "name": "node-red-contrib-tibber-api",
    "version": "x.y.z",
    "description": "Node-RED nodes for the Tibber API",
    "keywords": ["node-red", "tibber"],
    "license": "MIT",
    "dependencies": {},
    "node-red": {
        "version": ">=2.0.0",
        "nodes": {
            "sample": "nodes/sample.js"
        }
    }
}
```

- The `node-red.nodes` map is what makes Node-RED load your files: `type-name -> path/to/file.js`. The matching `.html` must sit next to the `.js` with the same basename.
- `"keywords": ["node-red"]` marks it as a Node-RED module (add only once the module is stable).
- Naming: this package predates the change and keeps `node-red-contrib-*`; **new** packages (since Jan 2022) should use scoped names like `@scope/node-red-<name>`.
- Optional `node-red.version` pins a minimum Node-RED version.
- Layout convention: node `.js`/`.html` pairs together (any subdirectory), custom `icons/` next to them, `examples/` (importable example flows as JSON) in the package root, plus `README.md` and `LICENSE`.
- Local testing: `cd ~/.node-red && npm install /path/to/module` (symlinks it; restart Node-RED to pick up changes). Unit tests: `node-red-node-test-helper` (`helper.load()`, `helper.getNode()`).
- Publishing: `npm publish`, then submit manually to the Flow Library at https://flows.nodered.org (the "+" button) — it no longer auto-indexes npm.

## Message conventions

- `msg.payload` is the primary data property — read input from it, write output to it. Be liberal in what you accept (string, number, object, buffer), consistent in what you send.
- `msg.topic` conventionally identifies the source/subject of the message (e.g. home id or metric name) and is used by many core nodes for routing/grouping.
- Preserve unrelated properties on the incoming `msg` when transforming — pass the same object through rather than constructing a fresh one, so users' `msg._msgid`, `msg.topic`, etc. survive.
- Document every input property read and output property set in the help text using the `<dl class="message-properties">` pattern.

## Internationalisation (optional)

- Catalogs live at `<node-dir>/locales/<lang>/<node>.json` (and localised help as `<node>.html`); default language `en-US`.
- JSON is namespaced by node: `{ "myNode": { "message1": "..." } }`.
- Runtime: `RED._("myNode.message1")` or `this._()` inside a node; status text accepts keys (`text:"myNode.status.ready"` or core keys like `"node-red:common.status.connected"`).
- Editor HTML: `data-i18n="myNode.label.foo"`, attribute form `data-i18n="[placeholder]myNode.placeholder.foo"`.

## Quick checklist for changes in this repo

1. New node type? Add the `.js` + `.html` pair and register it in `package.json` under `node-red.nodes`.
2. Every long-lived resource (Tibber feed/websocket, timers) must be torn down in `on('close', ...)` — redeploys call close then re-construct.
3. Use `node.status()` to reflect connection state (grey/ring idle, green/dot connected, red/ring error).
4. Report runtime failures with `done(err)` / `node.error(err, msg)` so Catch nodes work; never let a promise rejection escape unhandled.
5. Secrets (access tokens) belong in `credentials` with `type: "password"`, never in `defaults`.
