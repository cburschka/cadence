cadence
=======

cadence is a strophe.js-powered XMPP multi-user chat client that 
runs entirely in the browser without a server backend.

BUILDING
========

This development version references multiple JavaScript libraries as
submodules. Most of these can be used as checked out, but strophejs needs
to be built before use.

Install the YUI Compressor using your distribution's package manager or download
it here: https://github.com/yui/yuicompressor/downloads

    $ cd js/lib/strophe/
    $ env YUI_COMPRESSOR=/path/to/yui-compressor.jar make

Optionally, you can skip the compression and change the `index.html` file
to load `strophe.js` instead of `strophe.min.js`.

LICENSE
=======

    Copyright (c) 2014 "Arancaytar" (Christoph Burschka).

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

BASIS
=====

The visual style and static markup is based in part on 
AJAX-Chat (blueimp.net): https://github.com/frug/jquery-replacetext
(MIT)


LIBRARIES
=========

The following libraries are used without modifications in this project:

   * strophejs (Collecta Inc.): https://github.com/strophe/strophejs
     (MIT, with BSD and public domain parts)

   * jquery (jQuery Foundation): https://github.com/jquery/jquery
     (MIT)

   * momentjs: http://momentjs.com/ (MIT)
   
   * jquery-replacetext (Ben Alman): https://github.com/cowboy/jquery-replacetext
     (GPL / MIT)
  
   * jquery-cookie (Klaus Hartl): https://github.com/carhartl/jquery-cookie
     (MIT)
