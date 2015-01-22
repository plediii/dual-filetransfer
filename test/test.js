/*jslint node: true */
"use strict";

var assert = require('assert');
var dualapi = require('dualapi');
var filetransfer = require('../index');
var crypto = require('crypto');

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
                    statusCode: '209'
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
                    statusCode: '209'
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
                    statusCode: '209'
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
                    statusCode: '209'
                });
                ctxt.reply({
                    hash: digest(data)
                    , data: data.toString('utf8', 2, 4)
                    , dataLength: data.length - 1
                }, {
                    statusCode: '209'
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
                    statusCode: '209'
                });
                ctxt.reply({
                    hash: digest(data)
                    , data: data.toString('utf8', 2, 4)
                    , dataLength: data.length
                }, {
                    statusCode: '209'
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
                    statusCode: '209'
                });
                ctxt.reply({
                    hash: digest(data)
                    , data: data.toString('utf8', 2, 4)
                    , dataLength: data.length
                }, {
                    statusCode: '209'
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

    });

    describe('uploader', function () {
        
        it('should require a fetch argument', function () {
            assert.throws(filetransfer.uploader);
        });

        it('should request a buffer from the fetcher', function (done) {
            d.mount('master', filetransfer.uploader({
                fetch: function (_id) {
                    assert.equal(_id, 'germany');
                    done();
                }
            }));

            d.request(['master'], 'germany');
        });

        it('should respond to request with buffer data when below chunk size ', function (done) {
            var data = new Buffer('busorsomething');
            d.mount('master', filetransfer.uploader({
                fetch: function (_id) {
                    return data;
                }
                , maxchunk: 2 * data.length
            }));

            d.request(['master'], 'germany', { timeout: 1 })
            .spread(function (body) {
                assert.deepEqual(new Buffer(body.data), data);
                done();
            });
        });

        it('should respond to request with length of the buffer ', function (done) {
            var data = new Buffer('busorsomething');
            d.mount('master', filetransfer.uploader({
                fetch: function (_id) {
                    return data;
                }
                , maxchunk: 2 * data.length
            }));

            d.request(['master'], 'germany', { timeout: 1 })
            .spread(function (body) {
                assert.equal(body.dataLength, data.length);
                done();
            });
        });

        it('should respond to request with hash of the buffer ', function (done) {
            var data = new Buffer('busorsomething');
            d.mount('master', filetransfer.uploader({
                fetch: function (_id) {
                    return data;
                }
                , maxchunk: 2 * data.length
            }));

            d.request(['master'], 'germany', { timeout: 1 })
            .spread(function (body) {
                assert.equal(body.hash, digest(data));
                done();
            });
        });

        it('should respond to request with success status code ', function (done) {
            var data = new Buffer('busorsomething');
            d.mount('master', filetransfer.uploader({
                fetch: function (_id) {
                    return data;
                }
                , maxchunk: 2 * data.length
            }));

            d.request(['master'], 'germany', { timeout: 1 })
            .spread(function (body, options) {
                assert.equal(options.statusCode, '200');
                done();
            });
        });

        it('should reply with partial content when maxchunk is smaller than buffersize ', function (done) {
            var data = new Buffer('busorsomething');
            var maxchunk = Math.floor(data.length / 2);
            d.mount('master', filetransfer.uploader({
                fetch: function (_id) {
                    return data;
                }
                , maxchunk: maxchunk
            }));

            d.request(['master'], 'germany', { timeout: 1 })
            .spread(function (body) {
                assert.equal((new Buffer(body.data)).length, maxchunk);
                done();
            });
        });

        it('should reply with partial content partial content status code when maxchunk is smaller than buffersize ', function (done) {
            var data = new Buffer('busorsomething');
            var maxchunk = Math.floor(data.length / 2);
            d.mount('master', filetransfer.uploader({
                fetch: function (_id) {
                    return data;
                }
                , maxchunk: maxchunk
            }));

            d.request(['master'], 'germany', { timeout: 1 })
            .spread(function (body, options) {
                assert.equal(options.statusCode, '408');
                done();
            });
        });

        it('should reply with full data length when maxchunk is smaller than buffersize ', function (done) {
            var data = new Buffer('busorsomething');
            var maxchunk = Math.floor(data.length / 2);
            d.mount('master', filetransfer.uploader({
                fetch: function (_id) {
                    return data;
                }
                , maxchunk: maxchunk
            }));

            d.request(['master'], 'germany', { timeout: 1 })
            .spread(function (body) {
                assert.equal(body.dataLength, data.length);
                done();
            });
        });

        it('should reply with hash of full data length when maxchunk is smaller than buffersize ', function (done) {
            var data = new Buffer('busorsomething');
            var maxchunk = Math.floor(data.length / 2);
            d.mount('master', filetransfer.uploader({
                fetch: function (_id) {
                    return data;
                }
                , maxchunk: maxchunk
            }));

            d.request(['master'], 'germany', { timeout: 1 })
            .spread(function (body) {
                assert.equal(body.hash, digest(data));
                done();
            });
        });

        it('should reply with partial content when maxchunk option is smaller than buffersize ', function (done) {
            var data = new Buffer('busorsomething');
            var maxchunk = Math.floor(data.length / 2);
            d.mount('master', filetransfer.uploader({
                fetch: function (_id) {
                    return data;
                }
                , maxchunk: 2 * data.length
            }));

            d.request(['master'], 'germany', { timeout: 1, maxchunk: maxchunk })
            .spread(function (body, options) {
                assert.equal('408', options.statusCode);
                done();
            });
        });

    });

});
