cadence
=======

cadence is a JavaScript-based web client for XMPP Multi-User Chat
powered by strophe.js.

Requirements
------------

* An XMPP server with Multi-User Chat and either BOSH or WebSocket.
  [ejabberd](https://ejabberd.im/) is recommended, but any server should work.

Building cadence requires the following tools:

* GNU Make.
* Python 3.5+. If your system's `python` command points to an outdated version,
  be sure to use `make PYTHON=python3` to explicitly call the new interpreter.
* The Node Package Manager, [npm](http://npmjs.com/). All other NPM dependencies
  are installed automatically.

Building
--------

### Configuration

First, create your configuration file from the template in `install.dist.yml`.

#### configure.py

The `configure.py` script will create this file automatically, but editing it
manually allows additional configuration.

```
  -h, --help            show this help message and exit
  -s, --secure          Generate HTTPS or Secure WebSocket URLs
  --domain DOMAIN       XMPP domain to log in on.
  --muc MUC             The MUC conference server to connect to. [conference.DOMAIN]
  --url URL             BOSH or WebSocket URL to connect to [PROTOCOL://HOST:PORT/PATH]
  --protocol            The protocol to connect through [http, https, ws, wss].
  --host                The host to connect to, if it differs from the XMPP domain [DOMAIN]
  --port                The port to connect to [5280, 5281].
  --path                The socket path on the server to connect to [/http-bind or /websocket].
  --session-auth AUTH   The URL to use for session authentication.
  --profile PROFILE     The installation profile to create or update [install.yml].
```

* Only `--domain` is strictly required. `--muc` and `--url` are required if
  they differ from the default values.

* `--session-auth` is required if you would like to hook into an existing site's login
  system via [ejabberd-auth-php](https://github.com/cburschka/ejabberd-auth-php). It is
  the public URL of the `rpc.php` script in that software's session authentication plugin.

If the installation profile already exists, it will be updated.

#### Manual configuration

After running `configure.py` (or copying `install.dist.yml` to `install.yml`)
you can customize the configuration further.

The `config` key is merged into the default configuration that is defined in
`config/default.yml`. All values there may be overridden here.

The `install` key contains several directives for the setup scripts:

* `target` and `cdn.target` designate directories where the files will be installed.
  These are optional; the build directory is already a functional installation.

* `styles` and `packs` define the stylesheets and emoticon packs. This list is
  automatically generated from the contents of `assets/css/alt` and `emoticon-packs`.

### Make

After configuring, simply execute the Makefile.

    $ make && make install

To build from a custom profile:

    $ make profile=<profile.yml> && make install

The profile otherwise defaults to the most recent one used, or `install.yml`.

License
-------

The MIT License (MIT)

Copyright (c) 2014-2015 Christoph Burschka

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.


Basis
-----

The visual style and static markup is based in part on
AJAX-Chat (blueimp.net): https://github.com/Frug/AJAX-Chat
(MIT)


Libraries
---------

The following libraries are used without modifications in this project.
These libraries are not included, but are downloaded automatically
during the build process.

   * Strophe.js (Collecta Inc.): http://strophe.im/strophejs/
     (MIT)

   * jQuery (jQuery Foundation): https://jquery.com/
     (MIT)

   * jQuery UI (jQuery Foundation): https://jqueryui.com/

   * Moment.js: http://momentjs.com/ (MIT)

   * JavaScript Cookie (Klaus Hartl): https://github.com/js-cookie/js-cookie
     (MIT)

   * Buzz (Jay Salvat): https://github.com/jaysalvat/buzz
     (MIT)

   * FileSaver.js (Eli Grey): https://github.com/eligrey/FileSaver.js
     (MIT)

   * jQuery replaceText (Christoph Burschka): https://github.com/cburschka/jquery-replacetext
     (MIT)

   * xbbcode.js (Christoph Burschka): https://github.com/cburschka/xbbcode.js
     (MIT)
