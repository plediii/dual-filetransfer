/*jslint node: true */
"use strict";

var assert = require('assert');
var dualapi = require('dualapi');
var filetransfer = require('../index');
var crypto = require('crypto');
var Promise = require('bluebird');

var digest = function (a, b) {
    var shasum = crypto.createHash('sha256');
    shasum.update(a);
    if (b) {
        shasum.update(b);
    }
    return shasum.digest('binary');
};

describe('dual filetransfer', function () {
    
    var d;
    beforeEach(function () {
        d = dualapi();
    });

    describe('downloader', function () {

        it('should timeout', function (done) {
            var count = 0;
            d.mount(['splendid'], function (ctxt) {
                count++;
            });

            filetransfer.download(d, ['splendid'], 'fence', { timeout: 1 })
            .catch(function (err) {
                assert.equal(err.statusCode, '408');
                assert.equal(1, count);
                done();
            });
        });

        it('should not leak listeners on timeout', function (done) {
            d.mount(['splendid'], function (ctxt) {
            });

            var beforeCount = d.listeners('**').length;
            filetransfer.download(d, ['splendid'], 'fence', { timeout: 1 })
            .catch(function (err) {
                assert.equal(beforeCount, d.listeners('**').length);
                done();
            });
        });
        
        it('should submit an initial request to uploader', function (done) {
            d.mount(['splendid'], function (ctxt) {
                assert.equal(ctxt.body._id, 'fence');
                assert.equal(ctxt.options.know, 'thoughts');
                done();
            });
            d.mount(['error'], function (ctxt) {
                done(ctxt.body);
            });

            filetransfer.download(d, ['splendid'], 'fence', { know: 'thoughts', timeout: 1 })
                .catch(function (err) {
                    if (err.statusCode !== '408') {
                        done(err);
                    }
                });
        });

        it('should resolve when the complete file is returned', function (done) {
            var data = new Buffer('verb');
            d.mount(['splendid'], function (ctxt) {
                return ctxt.reply({
                    hash: digest(data)
                    , data: data.toString()
                    , dataLength: data.length
                }, {
                    statusCode: '200'
                });
            });
            d.mount(['error'], function (ctxt) {
                done(ctxt.body);
            });

            filetransfer.download(d, ['splendid'], 'fence', { timeout: 1 })
                .then(function (f) {
                    assert.deepEqual(data, f);
                    done();
                })
                .catch(done);
        });

        it('should not leak listener', function (done) {
            var data = new Buffer('verb');
            d.mount(['splendid'], function (ctxt) {
                return ctxt.reply({
                    hash: digest(data)
                    , data: data.toString()
                    , dataLength: data.length
                }, {
                    statusCode: '200'
                });
            });
            d.mount(['error'], function (ctxt) {
                done(ctxt.body);
            });
            var beforeCount = d.listeners('**').length;

            filetransfer.download(d, ['splendid'], 'fence', { timeout: 1 })
                .then(function (f) {
                    assert.equal(beforeCount, d.listeners('**').length);
                    done();
                })
                .catch(done);
        });

        it('should reject when hash doesnt match', function (done) {
            var data = new Buffer('verb');
            var baddata = new Buffer('ciber');
            d.mount(['splendid'], function (ctxt) {
                ctxt.reply({
                    hash: digest(baddata)
                    , data: data.toString()
                    , dataLength: data.length
                }, {
                    statusCode: '200'
                });
            });
            d.mount(['error'], function (ctxt) {
                done(ctxt.body);
            });

            filetransfer.download(d, ['splendid'], 'fence', { timeout: 1 })
                .catch(function (err) {
                    assert.equal(err.statusCode, '500');
                    done();
                })
                    .catch(done);
        });

        it('should reject when length doesnt match', function (done) {
            var data = new Buffer('verb');
            d.mount(['splendid'], function (ctxt) {
                ctxt.reply({
                    hash: digest(data)
                    , data: data.toString()
                    , dataLength: data.length - 1
                }, {
                    statusCode: '200'
                });
            });
            d.mount(['error'], function (ctxt) {
                done(ctxt.body);
            });

            filetransfer.download(d, ['splendid'], 'fence', { timeout: 1 })
                .catch(function (err) {
                    assert.equal(err.statusCode, '500');
                    done();
                });
        });

        it('should assembly partial replies', function (done) {
            var data = new Buffer('verb');
            d.mount(['splendid'], function (ctxt) {
                ctxt.reply({
                    hash: digest(data)
                    , data: data.toString('utf8', 0, 2)
                    , dataLength: data.length
                }, {
                    statusCode: '206'
                });
                ctxt.reply({
                    hash: digest(data)
                    , data: data.toString('utf8', 2)
                    , dataLength: data.length
                }, {
                    statusCode: '200'
                });
            });
            d.mount(['error'], function (ctxt) {
                done(ctxt.body);
            });

            filetransfer.download(d, ['splendid'], 'fence', { timeout: 1 })
            .then(function (f) {
                assert.deepEqual(f, data);
                done();
            })
                .catch(done);
        });

        it('should timeout if second part does not arrive', function (done) {
            var data = new Buffer('verb');
            d.mount(['splendid'], function (ctxt) {
                ctxt.reply({
                    hash: digest(data)
                    , data: data.toString('utf8', 0, 2)
                    , dataLength: data.length
                }, {
                    statusCode: '206'
                });
            });
            d.mount(['error'], function (ctxt) {
                done(ctxt.body);
            });

            filetransfer.download(d, ['splendid'], 'fence', { timeout: 1 })
            .catch(function (err) {
                assert.equal(err.statusCode, '408');
                done();
            });
        });

        it('should reject if hash changes', function (done) {
            var data = new Buffer('verb');
            var baddata = new Buffer('roswell');
            d.mount(['splendid'], function (ctxt) {
                ctxt.reply({
                    hash: digest(data)
                    , data: data.toString('utf8', 0, 2)
                    , dataLength: data.length
                }, {
                    statusCode: '206'
                });
                ctxt.reply({
                    hash: digest(baddata)
                    , data: data.toString('utf8', 2)
                    , dataLength: data.length
                }, {
                    statusCode: '200'
                });
            });
            d.mount(['error'], function (ctxt) {
                done(ctxt.body);
            });

            filetransfer.download(d, ['splendid'], 'fence', { timeout: 1 })
            .catch(function (err) {
                assert.deepEqual(err.statusCode, '500');
                done();
            });
        });

        it('should reject if length changes', function (done) {
            var data = new Buffer('verbful');
            d.mount(['splendid'], function (ctxt) {
                ctxt.reply({
                    hash: digest(data)
                    , data: data.toString('utf8', 0, 2)
                    , dataLength: data.length
                }, {
                    statusCode: '206'
                });
                ctxt.reply({
                    hash: digest(data)
                    , data: data.toString('utf8', 2, 4)
                    , dataLength: data.length - 1
                }, {
                    statusCode: '206'
                });
                ctxt.reply({
                    hash: digest(data)
                    , data: data.toString('utf8', 4)
                    , dataLength: data.length
                }, {
                    statusCode: '200'
                });
            });
            d.mount(['error'], function (ctxt) {
                done(ctxt.body);
            });

            filetransfer.download(d, ['splendid'], 'fence', { timeout: 1 })
            .catch(function (err) {
                assert.deepEqual(err.statusCode, '500');
                done();
            });
        });

        it('should reject if length not initially provided', function (done) {
            var data = new Buffer('verbful');
            d.mount(['splendid'], function (ctxt) {
                ctxt.reply({
                    hash: digest(data)
                    , data: data.toString('utf8', 0, 2)
                }, {
                    statusCode: '206'
                });
                ctxt.reply({
                    hash: digest(data)
                    , data: data.toString('utf8', 2, 4)
                    , dataLength: data.length
                }, {
                    statusCode: '206'
                });
                ctxt.reply({
                    hash: digest(data)
                    , data: data.toString('utf8', 4)
                    , dataLength: data.length
                }, {
                    statusCode: '200'
                });
            });
            d.mount(['error'], function (ctxt) {
                done(ctxt.body);
            });

            filetransfer.download(d, ['splendid'], 'fence', { timeout: 1 })
            .catch(function (err) {
                assert.deepEqual(err.statusCode, '500');
                done();
            });
        });

        it('should reject if hash not initially provided', function (done) {
            var data = new Buffer('verbful');
            d.mount(['splendid'], function (ctxt) {
                ctxt.reply({
                    data: data.toString('utf8', 0, 2)
                    , dataLength: data.length
                }, {
                    statusCode: '206'
                });
                ctxt.reply({
                    hash: digest(data)
                    , data: data.toString('utf8', 2, 4)
                    , dataLength: data.length
                }, {
                    statusCode: '206'
                });
                ctxt.reply({
                    hash: digest(data)
                    , data: data.toString('utf8', 4)
                    , dataLength: data.length
                }, {
                    statusCode: '200'
                });
            });
            d.mount(['error'], function (ctxt) {
                done(ctxt.body);
            });

            filetransfer.download(d, ['splendid'], 'fence', { timeout: 1 })
            .catch(function (err) {
                assert.deepEqual(err.statusCode, '500');
                done();
            });
        });

        describe('progress', function () {

            it('should be called for each chunk', function (done) {
                var data = new Buffer('verbscam');
                d.mount(['splendid'], function (ctxt) {
                    ctxt.reply({
                        hash: digest(data)
                        , data: data.toString('utf8', 0, 2)
                        , dataLength: data.length
                    }, {
                        statusCode: '206'
                    });
                    ctxt.reply({
                        hash: digest(data)
                        , data: data.toString('utf8', 2, 4)
                        , dataLength: data.length
                    }, {
                        statusCode: '206'
                    });
                    ctxt.reply({
                        hash: digest(data)
                        , data: data.toString('utf8', 4)
                        , dataLength: data.length
                    }, {
                        statusCode: '200'
                    });
                });
                d.mount(['error'], function (ctxt) {
                    done(ctxt.body);
                });

                var count = 0;
                filetransfer.download(d, ['splendid'], 'fence', { timeout: 1 }
                                      , function (progress) {
                                          count++;
                                          if (count === 1) {
                                              assert.equal(2/8, progress);
                                          }
                                          else if (count === 2) {
                                              assert.equal(4/8, progress);
                                              done();
                                          }
                                      })
                    .catch(done);
            });

        });

    });

});
