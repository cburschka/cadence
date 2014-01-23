ifndef YUI_COMPRESSOR
	YUI_COMPRESSOR=/usr/share/yui-compressor/yui-compressor.jar
endif

all: submodules strophe js/core/config.js index.html

js/core/config.js: .sed.script
	sed -f .sed.script < js/core/config.sample.js > js/core/config.js

index.html: .sed.script
	sed -f .sed.script < index.tpl.html > index.html

clean:
	$(MAKE) -C js/lib/strophe clean

submodules:
	@@git submodule update --init

update-libs:
	for lib in `ls js/lib/`; do git -C js/lib/$$lib pull; done;

strophe:
	env YUI_COMPRESSOR=$(YUI_COMPRESSOR) $(MAKE) -C js/lib/strophe

.sed.script: .config.status
	cat .config.status | sed 's/[\%]/\\&/g;s/\([^=]*\)=\(.*\)/s%\\$$\1\\$$%\2%g/' > .sed.script;

.config.status: configure
	./configure ; if [ $$? -eq "1" ]; then exit 1; fi


.PHONY: all clean submodules strophe
