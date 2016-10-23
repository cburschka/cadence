ifndef CP
  CP=cp
endif

ifndef BABEL
  BABEL=babel
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

JS_FILES = ${CORE_FILES} ${LIB_FILES}

all: submodules emoticons init index.html ${JS_FILES}

install: all
	./install.py

init:
	mkdir -p lib/modules/strophe

emoticons:
	$(CP) -Tau "emoticon-packs" "assets/emoticons"

index.html: index.tpl.html install.yml
	./setup.py $@

emoticons.js: $(wildcard emoticon-packs/*/emoticons.conf)
	./setup.py $@

lib: $(CORE_FILES)
lib/%.js: src/%.js
	$(BABEL) $^ >$@

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

install.yml:
	./configure.py


.SECONDEXPANSION:
