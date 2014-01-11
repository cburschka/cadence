ifndef YUI_COMPRESSOR
	YUI_COMPRESSOR=/usr/share/yui-compressor/yui-compressor.jar
endif

all: submodules strophe

clean:
	$(MAKE) -C js/lib/strophe clean

submodules:
	@@git submodule update --init

strophe:
	env YUI_COMPRESSOR=$(YUI_COMPRESSOR) $(MAKE) -C js/lib/strophe

.PHONY: all clean submodules strophe
