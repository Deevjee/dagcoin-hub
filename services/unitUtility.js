"use strict";

function Unit(hash) {
    this.hash = hash;
    this.dbManager = require('dagcoin-core/lib/databaseManager').getInstance();
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

Unit.prototype.getDagcoinReceivers = function () {
    const self = this;

    const conf = require('byteballcore/conf');

    const addresses = [];

    self.unit.messages.forEach((message) => {
        if (message.app === 'payment' && message.payload.asset === conf.dagcoinAsset) {
            message.payload.outputs.forEach((output) => {
                let isNew = true;

                console.log(output);

                addresses.forEach((address) => {
                    if (output.address === address.address) {
                        isNew = false;
                        address.amount += output.amount;
                    }
                });

                if (isNew) {
                    addresses.push(output);
                }
            });
        }
    });

    return Promise.resolve(addresses);
};

Unit.prototype.getDagcoinPaymentAuthors = function () {
    const self = this;

    const conf = require('byteballcore/conf');

    const authors = [];

    self.unit.authors.forEach((author) => {
        authors.push(author.address);
    });

    console.log(JSON.stringify(authors));

    const inputs = [];
    const units = [];
    const loadingPromises = [];

    self.unit.messages.forEach((message) => {
        if (message.app === 'payment' && message.payload.asset === conf.dagcoinAsset) {
            message.payload.inputs.forEach((input) => {
                inputs.push(input.unit);
                const unit = new Unit(input.unit);
                units.push(unit);
                loadingPromises.push(unit.load());
            });
        }
    });

    const dagcoinPayers = [];

    return Promise.all(loadingPromises).then(() => {
        units.forEach((unitObj) => {
            const unit = unitObj.unit;

            unit.messages.forEach((message) => {
                if (message.app === 'payment' && message.payload.asset === conf.dagcoinAsset) {
                    message.payload.outputs.forEach((output) => {
                        if (authors.indexOf(output.address) >= 0 && dagcoinPayers.indexOf(output.address) < 0) {
                            dagcoinPayers.push(output.address);
                        }
                    });
                }
            });
        });

        console.log(JSON.stringify(dagcoinPayers));

        return Promise.resolve(dagcoinPayers);
    });
};

Unit.prototype.getReceiptId = function () {
    const self = this;

    let paymentId = null;
    let error = null;

    self.unit.messages.forEach((message) => {
        if (message.app === 'text') {
            const receipt = JSON.parse(message.payload);

            console.log(JSON.stringify(receipt));

            if (paymentId) {
                error = `PAYMENT ID DECLARED MULTIPLE TIMES IN UNIT ${self.hash}`;
            }

            paymentId = receipt.paymentId;
        }
    });

    if (error) {
        return Promise.reject(error);
    }

    return Promise.resolve(paymentId);
};

Unit.prototype.getPaymentInfo = function () {
  const unitInfo = {};

  const self = this;

  return self.checkIsDagcoin(
  ).then((isDagcoin) => {
      unitInfo.isDagcoin = isDagcoin;

      if (isDagcoin) {
          return self.getAdditionalPaymentInfo(unitInfo);
      } else {
          return Promise.resolve(unitInfo);
      }
  });
};

Unit.prototype.getAdditionalPaymentInfo = function (unitInfo) {
    const self = this;

    return self.checkIsStable().then((isStable) => {
        unitInfo.isStable = isStable;

        console.log(`IS STABLE? ${isStable}`);
        //TODO: return next info checker
        return self.getDagcoinPaymentAuthors();
    }).then((dagcoinPayers) => {
        unitInfo.dagcoinPayers = dagcoinPayers;

        return self.getReceiptId();
    }).then((paymentId) => {
        unitInfo.paymentId = paymentId;

        return self.getDagcoinReceivers();
    }).then((dagcoinReceivers) => {
        unitInfo.dagcoinReceivers = dagcoinReceivers;

        return Promise.resolve(unitInfo);
    });
};

Unit.prototype.checkIsStable = function () {
    const self = this;

    return self.dbManager.query('SELECT is_stable FROM units WHERE unit = ?', [self.hash]).then((rows) => {
        if (rows == null || rows.length === 0) {
            return Promise.reject(`UNIT WITH HASH ${self.hash} NOT FOUND IN THE DATABASE`);
        }

        if (rows.length > 1) {
            return Promise.reject(`MORE THAN ONE UNIT ROW FOR HASH ${self.hash} THIS IS A SERIOUS DATABASE INCONSISTENCY PROBLEM`);
        }

        return Promise.resolve(rows[0].is_stable === 1);
    });
};

module.exports = Unit;