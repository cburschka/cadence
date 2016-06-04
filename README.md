cadence
=======

cadence is a JavaScript-based web client for XMPP Multi-User Chat
powered by strophe.js.

Requirements
------------

* An XMPP server with Multi-User Chat and either BOSH or WebSocket
  support is required to run cadence.
* Python 2.7+ (or 3+), [Babel](https://babeljs.io) and GNU Make are
  required in the build process.


Building
--------

### Configuration

First, run the configure script. These arguments are supported:

```
  -h, --help            show this help message and exit
  -s, --secure          Generate HTTPS or Secure WebSocket URLs
  --domain DOMAIN       XMPP domain to log in on.
  --url URL             BOSH or WebSocket URL to connect to [PROTOCOL://HOST:PORT/PATH]
  --protocol            The protocol to connect through [http, https, ws, wss].
  --host                The host to connect to, if it differs from the XMPP domain [DOMAIN]
  --port                The port to connect to [5280, 5281].
  --path                The socket path on the server to connect to [/http-bind or /websocket].
  --session-auth AUTH   The URL to use for session authentication.
  --muc MUC             The MUC conference server to connect to. [conference.DOMAIN]
  --title TITLE         The page title. ["cadence"]
  --style STYLE         The default style. ["Stygium"]
  --cdn-url CDN_URL     Base URL for resources. (Optional)
  --prefix PREFIX       Directory to install cadence to ["."]
  --cdn-prefix CDN_PREFIX
                        Directory to install resources to [PREFIX]
  --aggregate           Aggregate JS and CSS files when possible.
```

* Only `--domain` is strictly required. `--muc` and `--url` are required if
  they differ from the default values.

* `--session-auth` is required if you would like to hook into an existing site's login
  system via [ejabberd-auth-php](https://github.com/cburschka/ejabberd-auth-php). It is
  the public URL of the `rpc.php` script in that software's session authentication plugin.

* `--title` merely affects the client branding.

* The `--prefix` is required to cleanly deploy the application to a directory.

* The `--cdn-prefix` and `cdn-url` options are used to deploy the application's resources
  to a CDN. If this is given, all but the index.html file are deployed there.
  (You can also use the CDN for index.html file with `--prefix`, but this will make
  the application harder to find, and will break session-authentication due to
  cross-site security policies.

### Make

Then simply execute the Makefile.

    $ make && make install

Customizing the Settings
------------------------

It is not recommended to edit `js/core/config.js` (if this file even exists, and has
not been aggregated and minified), because it will be overwritten if the software
is rebuilt from source.

Instead, the installer places a file named `config.custom.js` into the install directory
along with your index.html file. Add any configuration changes to this file
by assigning or deleting keys in the global `config` object.


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
