#!/usr/bin/env bash

if [ "$1" != "development" -a "$1" != "testnet" -a "$1" != "live" ]; then
    echo "$1 is not a valid environment. Use development, testnet or live"
    exit 1
fi

rm -rf node_modules
rm conf.js

npm install

cp "environments/$1.conf.js" conf.js
