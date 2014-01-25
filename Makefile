# Bump this version whenever tagging a new release.
VERSION=1.1

ifndef YUI_COMPRESSOR
	YUI_COMPRESSOR=/usr/share/yui-compressor/yui-compressor.jar
endif

SHELL=/bin/bash

all: init js/core/config.js index.html js/lib/buzz/.git strophe

init:
	if [ -d ".git" ]; then \
		VERSION=`git describe --always`; \
		touch .version; \
		if [ "`cat .version`" != "$$VERSION" ]; then \
			touch -c .config.status; \
			echo "$$VERSION" > .version; \
		fi; \
	else \
		echo "${VERSION}" > .version; \
	fi;

js/core/config.js: .sed.script js/core/config.sample.js
	sed -f .sed.script < js/core/config.sample.js > js/core/config.js

index.html: .sed.script index.tpl.html
	sed -f .sed.script < index.tpl.html > index.html

clean:
	$(MAKE) -C js/lib/strophe clean

js/lib/buzz/.git:
	if [ -d ".git" ]; then \
		git submodule update --init; \
	else \
		cat .gitmodules | \
		grep '\(url\|path\)' | \
		sed -e '{N;s/\n/ /g}' | \
		awk '{print $$6,$$3}' | \
		while read line; do \
			git clone $$line; \
		done; \
	fi;

update-libs:
	for lib in `ls js/lib/`; do git -C js/lib/$$lib pull; done;

strophe: js/lib/strophe/.git
	env YUI_COMPRESSOR=$(YUI_COMPRESSOR) $(MAKE) -C js/lib/strophe

.config.status:
	./configure --help
	exit 1

.sed.script: .config.status
	cat .config.status | sed 's/[\%]/\\&/g;s/\([^=]*\)=\(.*\)/s%\\$$\1\\$$%\2%g/' > .sed.script
	echo 's%\$$version\$$%'`cat .version`'%g' >> .sed.script

.PHONY: all clean submodules strophe
