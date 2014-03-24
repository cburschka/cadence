cadence
=======

cadence is a strophe.js-powered XMPP multi-user chat client that 
runs entirely in the browser without a server backend.

Requirements
------------

* Building cadence requires Python 2.7+ (or 3+) and GNU Make
* Optional JS and CSS compression uses the YUI Compressor utility.
  Install it using your distribution's package manager or download
  it here: https://github.com/yui/yuicompressor/releases

Building
--------

### Configuration

First, run the configure script. The script can be executed from any
location outside the source directory ("out-of-source") or directly inside
("in source").

These arguments are supported:

```
  -h, --help            show this help message and exit
  -s, --https           Generate HTTPS URLs
  --domain DOMAIN       XMPP domain to log in on.
  --bosh BOSH           BOSH URL to connect to [http(s)://DOMAIN:528(0|1)/http-bind]
  --session-auth AUTH   The URL to use for session authentication.
  --muc MUC             The MUC conference server to connect to. [conference.DOMAIN]
  --chatbot CHATBOT     The displayed name of the virtual ChatBot. ["Info"]
  --title TITLE         The page title. ["cadence"]
  --cdn-url CDN_URL     Base URL for resources. (Optional)
  --prefix PREFIX       Directory to install cadence to ["."]
  --cdn-prefix CDN_PREFIX
                        Directory to install resources to [PREFIX]
  --mode debug|aggregate|minify
                        Whether to optimize JS/CSS files ["minify"]
```

* Only `--domain` is strictly required. `--muc` and `--bosh` are required if
  they differ from the default values.

* `--session-auth` is required if you would like to hook into an existing site's login 
  system via [ejabberd-auth-php](https://github.com/cburschka/ejabberd-auth-php). It is
  the public URL of the `rpc.php` script in that software's session authentication plugin.

* `--chatbot` and `--title` merely affect the client branding.

* The `--prefix` is required to cleanly deploy the application to a directory.
  (An in-source build is a functional installation, but an out-of-source build must
  be installed before use, because static resources are not copied to the build location.)

* The `--cdn-prefix` and `cdn-url` options are used to deploy the application's resources
  to a CDN. If this is given, all but the index.html file are deployed there.
  (You can also use the CDN for index.html file with `--prefix`, but this will make
  the application harder to find, and will break session-authentication due to
  cross-site security policies.

The `--mode` determines whether to aggregate and minify the scripts and stylesheets.
For development, "debug" is recommended.

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

Copyright (c) 2014 Christoph Burschka <christoph@burschka.de>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.

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

   * strophejs (Collecta Inc.): https://github.com/strophe/strophejs
     (MIT, with BSD and public domain parts)

   * jquery (jQuery Foundation): https://github.com/jquery/jquery
     (MIT)

   * momentjs: http://momentjs.com/ (MIT)
   
   * jquery-replacetext (Ben Alman): https://github.com/cowboy/jquery-replacetext
     (GPL / MIT, used under MIT terms)
  
   * jquery-cookie (Klaus Hartl): https://github.com/carhartl/jquery-cookie
     (MIT)

   * buzz (Jay Salvat): https://github.com/jaysalvat/buzz
     (MIT)

   * FileSaver.js (Eli Grey): https://github.com/eligrey/FileSaver.js
     (MIT/X11)

   * xbbcode.js (Christoph Burschka): https://github.com/cburschka/xbbcode.js
     (GPL v2+)
