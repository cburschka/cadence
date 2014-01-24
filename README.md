cadence
=======

cadence is a strophe.js-powered XMPP multi-user chat client that 
runs entirely in the browser without a server backend.

Requirements
------------

Building cadence currently requires the YUI Compressor to compress Javascript
libraries. Install it using your distribution's package manager or download
it here: https://github.com/yui/yuicompressor/downloads

Building
--------

These sources will not work as checked out, but need to be built.
Currently, only in-source builds are supported.


### Configuration

First, run the configure script. These arguments are supported:

    -s, --https         automatically generate HTTPS URLs.
    --domain=DOMAIN     XMPP domain to log in on.
    --bosh=URL          BOSH URL to connect to [http://DOMAIN:5280/http-bind/]
                                          or [https://DOMAIN:5281/http-bind/]
    --muc=DOMAIN        the MUC domain to log in on. [conference.DOMAIN]
    --session-auth=URL  Optional. The URL to use for session authentication.
    --chatbot=STR       the displayed name of the virtual ChatBot [Info]
    --version=STR       the version string to be displayed [calref-1.0-34-gcca45e8]
    --title=STR         the page title to be displayed [cadence]
    --logo=URL          URL (can be relative) of the logo to show [img/logo.png]

Only `--domain` is strictly required. `--muc` and `--bosh` are required if
they are other than the default values.

`--session-auth` is required if you would like to hook into an existing site's login 
system via [ejabberd-auth-php](https://github.com/cburschka/ejabberd-auth-php). It is
the public URL of the `rpc.php` script in that software's session authentication plugin.

`--chatbot`, `--title`, `--logo` and `--version` merely affect the client branding.


### Make

Then simply execute the Makefile.

    $ make

By default, the `yui-compressor.jar` file will be looked for in 
`/usr/share/yui-compressor/yui-compressor.jar`. If this is not correct,
set the `YUI_COMPRESSOR` variable to the correct path when running make.

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
     (GPL / MIT)
  
   * jquery-cookie (Klaus Hartl): https://github.com/carhartl/jquery-cookie
     (MIT)
