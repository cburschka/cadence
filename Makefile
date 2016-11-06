PYTHON=python
export PATH := $(PATH):node_modules/.bin
BABEL=babel
JSYAML=js-yaml
CP=cp

PROFILE_DEFAULT=install.yml
include .profile
profile=$(PROFILE_DEFAULT)

SRC = $(wildcard src/*.js)
CORE_FILES = $(SRC:src/%.js=lib/%.js)

LIB_FILES = lib/modules/buzz.js lib/modules/contextmenu.js \
            lib/modules/filesaver.js lib/modules/isotope.js \
            lib/modules/moment.js lib/modules/replacetext.js lib/modules/strophe.js \
            lib/modules/strophe/attention.js lib/modules/strophe/caps.js \
            lib/modules/strophe/disco.js lib/modules/strophe/ping.js \
            lib/modules/strophe/storage.js \
            lib/modules/strophe/time.js lib/modules/strophe/version.js \
            lib/modules/xbbcode.js lib/modules/babel.js

JS_FILES = ${CORE_FILES} ${LIB_FILES}

all: profile

all_: init emoticons locales index.html ${JS_FILES}

# Intercept the "all" target to update .profile first.
# This way, targets that depend on .profile will be rerun if it changes.
profile:
ifneq ($(profile),$(PROFILE_DEFAULT))
	$(RM) .profile
	$(MAKE) .profile
endif
	$(MAKE) all_

.profile:
	echo "PROFILE_DEFAULT=$(profile)" > .profile

install: all
	$(PYTHON) scripts/install.py $(profile)

init:
ifeq ("$(wildcard node_modules)","")
	npm install
endif
	mkdir -p lib/modules/strophe
	mkdir -p assets/locales/

emoticons:
	$(CP) -Tau "emoticon-packs" "assets/emoticons"

index.html: index.tpl.html $(profile) .profile
	$(PYTHON) scripts/setup.py $(profile)

lib: $(CORE_FILES)
lib/%.js: src/%.js
	$(BABEL) $^ >$@

LOCALE_SRC = $(wildcard locales/*.yml)
LOCALES = $(LOCALE_SRC:locales/%.yml=assets/locales/%.json)

assets/locales/%.json: locales/%.yml
	$(JSYAML) $^ >$@

locales: ${LOCALES}

lib/modules/buzz.js: node_modules/buzz/src/buzz.js
	$(CP) $^ $@

lib/modules/contextmenu.js: node_modules/jquery-contextmenu/dist/jquery.contextMenu.js
	$(CP) $^ $@

lib/modules/filesaver.js: node_modules/file-saver/FileSaver.js
	$(CP) $^ $@

lib/modules/isotope.js: node_modules/isotope-layout/dist/isotope.pkgd.js
	$(CP) $^ $@

lib/modules/moment.js: node_modules/moment/moment.js
	$(CP) $^ $@

lib/modules/replacetext.js: node_modules/jquery-replacetext/replacetext.js
	$(CP) $^ $@

lib/modules/strophe.js: node_modules/strophe.js/strophe.js
	$(CP) $^ $@

lib/modules/xbbcode.js: node_modules/xbbcode/xbbcode.js
	$(CP) $^ $@

lib/modules/strophe/%.js: node_modules/strophe-cadence/lib/%.js
	$(CP) $^ $@

lib/modules/babel.js: node_modules/babel-polyfill/browser.js
	$(CP) $^ $@

.PHONY: all js init profile install

$(profile):
	$(PYTHON) scripts/configure.py --profile $(profile)


.SECONDEXPANSION:
