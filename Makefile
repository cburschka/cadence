PROFILE='install.yml'
include .profile
profile=$(PROFILE)

ifndef CP
  CP=cp
endif

ifndef BABEL
  BABEL=babel
endif

ifndef JSYAML
  JSYAML=js-yaml
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

all: profile

all_: submodules emoticons init locales index.html ${JS_FILES}

# Intercept the "all" target to update .profile first.
# This way, targets that depend on .profile will be rerun if it changes.
profile:
ifneq ($(profile),$(PROFILE))
	echo "PROFILE=$(profile)" > .profile
endif
	make all_

install: all
	./install.py $(profile)

init:
	mkdir -p lib/modules/strophe
	mkdir -p assets/locales/

emoticons:
	$(CP) -Tau "emoticon-packs" "assets/emoticons"

index.html: index.tpl.html $(profile) .profile
	./setup.py $(profile)

lib: $(CORE_FILES)
lib/%.js: src/%.js
	$(BABEL) $^ >$@

LOCALE_SRC = $(wildcard locales/*.yml)
LOCALES = $(LOCALE_SRC:locales/%.yml=assets/locales/%.json)

assets/locales/%.json: locales/%.yml
	$(JSYAML) $^ >$@

locales: ${LOCALES}

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

$(profile):
	./configure.py --profile $(profile)


.SECONDEXPANSION:
