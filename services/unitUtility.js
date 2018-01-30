"use strict";

function Unit(hash) {
    this.hash = hash;
}

Unit.prototype.load = function () {
    const self = this;

    const storage = require('byteballcore/storage');
    const db = require('byteballcore/db');

    return new Promise((resolve, reject) => {
        storage.readJoint(db, self.hash, {
            ifNotFound: function(){
                reject("UNIT NOT FOUND!");
            },
            ifFound: function(objJoint){
                if (objJoint == null) {
                    reject(`JOINT CORRESPONDING TO ${self.hash} IS NULL`);
                } else if (objJoint.unit == null) {
                    reject(`JOINT CORRESPONDING TO ${self.hash} IS NOT AN UNIT`);
                } else {
                    self.unit = objJoint.unit;
                    console.log(JSON.stringify(objJoint));
                    resolve(self);
                }
            }
        });
    })
};

Unit.prototype.checkIsDagcoin = function () {
    const self = this;

    if (self.unit == null) {
        return Promise.reject(new Error('UNIT IS NULL. DID YOU FORGET TO CALL load?'));
    }

    const messages = self.unit.messages;

    if (messages == null) {
        return Promise.reject(new Error('NO MESSAGES IN THE UNIT'));
    }

    const conf = require('byteballcore/conf');

    return new Promise((resolve, reject) => {
        try {
            messages.forEach((message) => {
                if (message.payload.asset && message.payload.asset === conf.dagcoinAsset) {
                    resolve(true);
                }
            });

            resolve(false);
        } catch (e) {
            reject(`COULD NOT PROCESS SUCCESSFULLY MESSAGES IN UNIT ${self.hash}: ${e}`);
        }
    });
};

Unit.prototype.checkHasAuthor = function (address) {
    const self = this;

    if (self.unit == null) {
        return Promise.reject(new Error('UNIT IS NULL. DID YOU FORGET TO CALL load?'));
    }

    const authors = self.unit.authors;

    if (authors == null) {
        return Promise.reject(new Error('NO AUTHORS IN THE UNIT'));
    }

    return new Promise((resolve, reject) => {
        try {
            authors.forEach((author) => {
                if (author && author.address && author.address === address) {
                    resolve(true);
                }
            });

            resolve(false);
        } catch (e) {
            reject(`COULD NOT PROCESS SUCCESSFULLY AUTHORS IN UNIT ${self.hash}: ${e}`);
        }
    });
};

module.exports = Unit;