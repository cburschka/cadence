include .config.vars
ifndef SRC_PATH
  SRC_PATH=.
endif
include ${SRC_PATH}/VERSION

VPATH = ${SRC_PATH}

CORE_FILES = js/core/strings.js js/core/chat.js js/core/xmpp.js \
              js/core/ui.js js/core/visual.js js/core/config.js \
              js/core/init.js

CSS_FILES_GLOBAL = css/global/layout.css css/global/fonts.css \
                    css/global/color.css css/global/icons.css \
                    css/global/borders.css
ifndef CDN_PREFIX
  CDN_PREFIX = ${PREFIX}
endif
ifeq (${MODE},aggregate)
  JS_FILES = js/lib.js js/core.js
  CSS_FILES = css/global/all.css
endif
ifeq (${MODE},minify)
  JS_FILES = js/lib.min.js js/core.min.js
  CSS_FILES = css/global/all.min.css
endif
ifeq (${MODE},debug)
  JS_FILES = ${CORE_FILES}
  CSS_FILES = ${CSS_FILES_GLOBAL}
endif


all: init index.html strophe ${JS_FILES} ${CSS_FILES}

init:
	mkdir -p js/lib/ js/core/ css/global/

clean:
	rm -f index.html js/*.js js/lib/*.js css/*.css

install: all
	mkdir -p "${CDN_PREFIX}/css/" "${CDN_PREFIX}/js/"
	rsync -a "${SRC_PATH}/css/alt" "${CDN_PREFIX}/css/"
	rsync ${JS_FILES} "${CDN_PREFIX}/js"
	rsync ${CSS_FILES} "${CDN_PREFIX}/css"
	rsync -a "${SRC_PATH}/img" "${SRC_PATH}/sounds" "${CDN_PREFIX}/"
	rsync "${LOGO}" "${CDN_PREFIX}/img/splash.png"
	rsync index.html "${PREFIX}/"

templates:
	VERSION=${VERSION}
	if [ -d "${SRC_PATH}/.git" ]; then \
	    VERSION=`git --git-dir ${SRC_PATH}/.git describe --always --dirty`; \
	fi; \
	"${SRC_PATH}/setup.py" $$VERSION

index.html: index.tpl.html js/core/config.tpl.js .config.vars
	make templates

js/core/config.js: index.html

js/lib/buzz.js: js/lib/buzz/src/buzz.js
	cp $^ $@

js/lib/filesaver.js: js/lib/filesaver/FileSaver.js
	cp $^ $@

js/lib/jquery.cookie.js: js/lib/jquery-cookie/jquery.cookie.js
	cp $^ $@

js/lib/jquery.replacetext.js: js/lib/jquery-replacetext/jquery.ba-replacetext.js
	cp $^ $@

js/lib/moment.js: js/lib/moment/moment.js
	cp $^ $@

js/lib/strophe.js: js/lib/strophe/strophe.js
	cp $^ $@

strophe:
	$(MAKE) -C ${SRC_PATH}/js/lib/strophe/ strophe.js

js/lib/xbbcode.js: js/lib/xbbcode/xbbcode.js
	cp $^ $@

js/lib.js: js/lib/buzz.js js/lib/filesaver.js js/lib/jquery.cookie.js \
               js/lib/jquery.replacetext.js js/lib/moment.js \
               js/lib/strophe.js js/lib/xbbcode.js
	cat $^ > $@

js/core.js: ${CORE_FILES}
	cat $^ > $@

%.min.js: %.js
	yui-compressor $^ > $@
%.min.css: %.css
	yui-compressor $^ > $@

core:
	rsync --exclude "*.tpl.js" ${SRC_PATH}/js/core/ js/core

css/global/all.css: ${CSS_FILES_GLOBAL}
	cat $^ > $@

.config.vars:
	${SRC_PATH}/configure --help
	exit 1

.PHONY: all js core strophe init
