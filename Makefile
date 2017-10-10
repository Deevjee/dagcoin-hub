VERSION=`cut -d '"' -f2 $BUILDDIR/../version.js`

UNAME := $(shell uname)

ifeq ($(UNAME), Linux)
  # do something Linux-y
  SHELLCMD := bash
endif

ifeq ($(UNAME), Darwin)
  # do something MAC
  SHELLCMD := sh
endif

dev:
	$(SHELLCMD) scripts/prepare.sh development
	$(SHELLCMD) scripts/testnetify.sh

test:
	$(SHELLCMD) scripts/prepare.sh testnet
	$(SHELLCMD) scripts/testnetify.sh

live:
	$(SHELLCMD) scripts/prepare.sh live
