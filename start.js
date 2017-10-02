/*jslint node: true */
"use strict";
require('byteball-relay');
var conf = require('./conf');
var network = require('byteballcore/network');
var eventBus = require('byteballcore/event_bus.js');
var push = require('./push');

eventBus.on('peer_version', function (ws, body) {
	if (body.program == conf.clientName) {
		if (conf.minClientVersion && compareVersions(body.program_version, conf.minClientVersion) == '<')
			network.sendJustsaying(ws, 'new_version', {version: conf.minClientVersion});
		if (compareVersions(body.program_version, '1.1.0') == '<')
			ws.close(1000, "mandatory upgrade");
	}
});

function compareVersions(currentVersion, minVersion) {
	if (currentVersion === minVersion) return '==';

	var cV = currentVersion.match(/([0-9])+/g);
	var mV = minVersion.match(/([0-9])+/g);
	var l = Math.min(cV.length, mV.length);
	var diff;

	for (var i = 0; i < l; i++) {
		diff = parseInt(cV[i], 10) - parseInt(mV[i], 10);
		if (diff > 0) {
			return '>';
		} else if (diff < 0) {
			return '<'
		}
	}

	diff = cV.length - mV.length;
	if (diff == 0) {
		return '==';
	} else if (diff > 0) {
		return '>';
	} else if (diff < 0) {
		return '<';
	}
}

function startBalanceService() {
    var express = require('express');
    var app = express();

    // This responds a GET request for the /list_user page.
    app.get('/getAddressBalance', function (req, res) {
    	const address = req.query.address;

        res.set("Connection", "close");

        getAddressBalances(address).then((balances) => {
            console.log(`BALANCES FOR ${address}: ${JSON.stringify(balances)}`);
            res.send(`BALANCES FOR ${address}: ${JSON.stringify(balances)}`);
            res.end();
		});
    });

    var server = app.listen(9852, function () {

        var host = server.address().address
        var port = server.address().port

        console.log("Example app listening at http://%s:%s", host, port)
    });
}

function getAddressBalances(address) {
	return new Promise((resolve) => {
        const db = require('byteballcore/db');
        db.query(
        	"SELECT COALESCE(outputs.asset, 'base') as asset, units.is_stable as stable, sum(outputs.amount) as amount \n\
			FROM outputs, units \n\
			WHERE units.unit = outputs.unit AND outputs.address = ? AND outputs.is_spent=0 \n\
			GROUP BY outputs.address, outputs.asset",
			[address],
			(rows) => {
        		const balances = {};

                balances['base'] = {};

                balances['base'].stable = 0;
                balances['base'].pending = 0;
                balances['base'].total = 0;

        		for (let index in rows) {
        			const balance = rows[index];

        			if(!balances[balance.asset]) {
                        balances[balance.asset] = {
                        	stable: 0,
							pending: 0
						};
					}

					if(balance.stable) {
                        balances[balance.asset].stable = balance.amount;
					} else {
                        balances[balance.asset].pending = balance.amount;
					}

                    balances[balance.asset].total = balances[balance.asset].stable + balances[balance.asset].pending;
				}

            	resolve(balances);
        	}
		);
    });
}

startBalanceService();