/*jslint node: true */
/* global -Promise */
"use strict";

var Promise = require('bluebird');
var _ = require('lodash');
var crypto = require('crypto');

var digest = function (a, b) {
    var shasum = crypto.createHash('sha256');
    shasum.update(a);
    if (b) {
        shasum.update(b);
    }
    return shasum.digest('binary');
};

module.exports = {
    uploader: function (options) {
        if (!options.hasOwnProperty('fetch')) {
            throw new Error('Fetch method not provided for uploader: ' + JSON.stringify(options));
        }
        var fetch = options.fetch;
        return {
            
        };
    }
    , download: function (d, to, _id, options) {
        return d.uid()
            .then(function (requestid) {
                return new Promise(function (resolve, reject) {
                    var timer;
                    var receiver;
                    var chunks = [];
                    var hash = false;
                    var dataLength = false;
                    var resetTimer = function () {
                        if (options.timeout > 0) {
                            timer = setTimeout(function () {
                                d.unmount([requestid]);
                                reject({
                                    message: 'Timeout.'
                                    , statusCode: '408'
                                });
                            }, 1000 * options.timeout);
                        }
                    };
                    receiver = function (ctxt) {
                        if (timer) {
                            clearTimeout(timer);
                        }
                        if (!hash) {
                            hash = ctxt.body.hash;
                        }
                        else if (hash !== ctxt.body.hash) {
                            return reject({
                                message: 'Hash change during partial assembly.'
                                , statusCode: '500'
                            });
                        }
                        if (!hash) {
                            return reject({
                                message: 'Hash not provided'
                                , statusCode: '500'
                            });
                        }

                        if (!dataLength) {
                            dataLength = ctxt.body.dataLength;
                        }
                        else if (dataLength !== ctxt.body.dataLength) {
                            return reject({
                                message: 'Data length change during partial assembly'
                                , statusCode: '500'
                            });
                        }
                        if (!dataLength) {
                            return reject({
                                message: 'Data length not provided'
                                , statusCode: '500'
                            });
                        }
                        chunks.push(new Buffer(ctxt.body.data));
                        if (ctxt.options.statusCode == '200') {
                            d.unmount([requestid]);
                            var f = Buffer.concat(chunks);
                            if (digest(f) !== hash) {
                                return reject({
                                    message: 'Hash mismatch.'
                                    , statusCode: '500'
                                });
                            }
                            if (dataLength !== f.length) {
                                return reject({
                                    message: 'Length mismatch: ' + dataLength + ' !== ' + f.length
                                    , statusCode: '500'
                                });
                            }
                            resolve(f);
                        }
                        else if (ctxt.options.statusCode == '209') {
                            resetTimer();
                        }
                        else {
                            return reject({
                                message: 'Unrecognized status code: ' + ctxt.options.statusCode
                                , statusCode: '500'
                            });
                        }
                    };
                    resetTimer();
                    d.mount([requestid], receiver);
                    d.send(to, [requestid], { _id: _id }, options);
                });
            });
    }
};
