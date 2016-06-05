include .config.vars
ifndef CP
  CP=cp
endif

SRC = $(wildcard src/*.js)
CORE_FILES = $(SRC:src/%.js=lib/%.js)

LIB_FILES = lib/modules/buzz.js lib/modules/contextmenu.js \
            lib/modules/filesaver.js lib/modules/cookie.js \
            lib/modules/moment.js lib/modules/replacetext.js lib/modules/strophe.js \
            lib/modules/strophe/attention.js lib/modules/strophe/caps.js \
            lib/modules/strophe/disco.js lib/modules/strophe/ping.js \
            lib/modules/strophe/storage.js \
            lib/modules/strophe/time.js lib/modules/strophe/version.js \
            lib/modules/xbbcode.js lib/modules/babel.js

ifndef CDN_PREFIX
  CDN_PREFIX = ${PREFIX}
endif
JS_FILES = ${CORE_FILES} ${LIB_FILES} config.js emoticons.js

all: submodules emoticons init index.html ${JS_FILES}

init:
	mkdir -p lib/modules/strophe

clean:
	rm -f index.html ${JS_FILES}

distclean: clean
	rm .config.vars
	rm Makefile

ifneq (.,${CDN_PREFIX})
install: all install-cdn
ifneq (.,${PREFIX})
	mkdir -p "${PREFIX}"
	$(CP) -au index.html config.js emoticons.js "${PREFIX}/"
endif
else
install: all ${JS_FILES}
endif
	touch -a "${PREFIX}/custom.css" "${PREFIX}/config.custom.js"

install-cdn: install-js
	mkdir -p "${CDN_PREFIX}"
	$(CP) -au "assets" "${CDN_PREFIX}/"

install-js: ${JS_FILES}
	$(CP) -au "lib/" "${CDN_PREFIX}/"

emoticons:
	$(CP) -Tau "emoticon-packs" "assets/emoticons"

config.js: config.tpl.js .config.vars
	VERSION=${VERSION}
	if [ -d ".git" ]; then \
	    VERSION=`git describe --always`; \
	fi; \
	./setup.py $@ $$VERSION

index.html: index.tpl.html .config.vars
	./setup.py $@

emoticons.js: $(wildcard emoticon-packs/*/emoticons.conf) .config.vars
	./setup.py $@

lib: $(CORE_FILES)
lib/%.js: src/%.js
	babel $< -o $@

lib/modules/buzz.js: modules/buzz/src/buzz.js
	$(CP) $^ $@

lib/modules/contextmenu.js: modules/contextmenu/src/jquery.contextMenu.js
	$(CP) $^ $@

lib/modules/filesaver.js: modules/filesaver/FileSaver.js
	$(CP) $^ $@

lib/modules/cookie.js: modules/cookie/src/js.cookie.js
	$(CP) $^ $@

lib/modules/moment.js: modules/moment/moment.js
	$(CP) $^ $@

lib/modules/replacetext.js: node_modules/jquery-replacetext/replacetext.js
	$(CP) $^ $@

lib/modules/strophe.js: modules/strophe/strophe.js
	$(CP) $^ $@

lib/modules/xbbcode.js: modules/xbbcode/xbbcode.js
	$(CP) $^ $@

lib/modules/strophe/%.js: node_modules/strophe-cadence/lib/%.js
	$(CP) $^ $@

lib/modules/babel.js: node_modules/babel-polyfill/browser.js
	$(CP) $^ $@

submodules:
	git submodule update --init

.PHONY: all js init submodules


.SECONDEXPANSION:

