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


    describe('uploader', function () {
        
        it('should require a fetch argument', function () {
            assert.throws(filetransfer.uploader);
        });

        it('should request a buffer from the fetcher', function (done) {
            d.mount('master', filetransfer.uploader({
                fetch: function (_id) {
                    assert.equal(_id, 'germany');
                    done();
                    return Promise.reject();
                }
            }));
            d.mount(['error'], function (ctxt) {
            });

            d.request(['master'], { _id: 'germany' });
        });

        it('should emit error if fetch rejects', function (done) {
            d.mount('master', filetransfer.uploader({
                fetch: function (_id) {
                    return Promise.reject('floor');
                }
            }));
            d.mount(['error'], function (ctxt) {
                assert.equal('floor', ctxt.body.message);
                done();
            });


            d.request(['master'], { _id: 'germany' })
            .catch(done);
        });

        it('should return error status code if fetch rejects', function (done) {
            d.mount('master', filetransfer.uploader({
                fetch: function (_id) {
                    return Promise.reject('floor');
                }
            }));
            d.mount(['error'], function (ctxt) {
            });


            d.request(['master'], { _id: 'germany' })
            .spread(function (body, options) {
                assert.equal(options.statusCode, '500');
                done();
            })
            .catch(done);
        });

        it('should return error status code if does not resolve to buffer', function (done) {
            d.mount('master', filetransfer.uploader({
                fetch: function (_id) {
                    return Promise.resolve('leaving');
                }
            }));
            d.mount(['error'], function (ctxt) {
            });


            d.request(['master'], { _id: 'germany' })
            .spread(function (body, options) {
                assert.equal(options.statusCode, '500');
                done();
            })
            .catch(done);
        });


        it('should respond to request with buffer data when below chunk size ', function (done) {
            var data = new Buffer('busorsomething');
            d.mount('master', filetransfer.uploader({
                fetch: function (_id) {
                    return Promise.resolve(data);
                }
                , maxchunk: 2 * data.length
            }));
            d.mount(['error'], function (ctxt) {
                done(ctxt.body);
            });


            d.request(['master'], { _id: 'germany' }, { timeout: 1 })
            .spread(function (body) {
                assert.deepEqual(new Buffer(body.data), data);
                done();
            })
            .catch(done);
        });

        it('should respond to request with buffer data when equal chunk size ', function (done) {
            var data = new Buffer('busorsomething');
            d.mount('master', filetransfer.uploader({
                fetch: function (_id) {
                    return Promise.resolve(data);
                }
                , maxchunk: data.length
            }));
            d.mount(['error'], function (ctxt) {
                done(ctxt.body);
            });


            d.request(['master'], { _id: 'germany' }, { timeout: 1 })
            .spread(function (body) {
                assert.deepEqual(new Buffer(body.data), data);
                done();
            })
            .catch(done);
        });

        it('should respond to request with sucess status code when below chunk size ', function (done) {
            var data = new Buffer('busorsomething');
            d.mount('master', filetransfer.uploader({
                fetch: function (_id) {
                    return Promise.resolve(data);
                }
                , maxchunk: 2 * data.length
            }));
            d.mount(['error'], function (ctxt) {
                done(ctxt.body);
            });


            d.request(['master'], { _id: 'germany' }, { timeout: 1 })
            .spread(function (body, options) {
                assert.equal(options.statusCode, '200');
                done();
            })
            .catch(done);
        });

        it('should respond to request with length of the buffer ', function (done) {
            var data = new Buffer('busorsomething');
            d.mount('master', filetransfer.uploader({
                fetch: function (_id) {
                    return Promise.resolve(data);
                }
                , maxchunk: 2 * data.length
            }));
            d.mount(['error'], function (ctxt) {
                done(ctxt.body);
            });


            d.request(['master'], { _id: 'germany' }, { timeout: 1 })
            .spread(function (body) {
                assert.equal(body.dataLength, data.length);
                done();
            })
            .catch(done);
        });

        it('should respond to request with hash of the buffer ', function (done) {
            var data = new Buffer('busorsomething');
            d.mount('master', filetransfer.uploader({
                fetch: function (_id) {
                    return Promise.resolve(data);
                }
                , maxchunk: 2 * data.length
            }));
            d.mount(['error'], function (ctxt) {
                done(ctxt.body);
            });


            d.request(['master'], { _id: 'germany' }, { timeout: 1 })
            .spread(function (body) {
                assert.equal(body.hash, digest(data));
                done();
            })
            .catch(done);
        });

        it('should respond to request with success status code ', function (done) {
            var data = new Buffer('busorsomething');
            d.mount('master', filetransfer.uploader({
                fetch: function (_id) {
                    return Promise.resolve(data);
                }
                , maxchunk: 2 * data.length
            }));
            d.mount(['error'], function (ctxt) {
                done(ctxt.body);
            });


            d.request(['master'], { _id: 'germany' }, { timeout: 1 })
            .spread(function (body, options) {
                assert.equal(options.statusCode, '200');
                done();
            })
            .catch(done);
        });

        it('should reply with partial content when maxchunk is smaller than buffersize ', function (done) {
            var data = new Buffer('busorsomething');
            var maxchunk = Math.floor(data.length / 2);
            d.mount('master', filetransfer.uploader({
                fetch: function (_id) {
                    return Promise.resolve(data);
                }
                , maxchunk: maxchunk
            }));
            d.mount(['error'], function (ctxt) {
                done(ctxt.body);
            });


            d.request(['master'], { _id: 'germany' }, { timeout: 1 })
            .spread(function (body) {
                assert.equal((new Buffer(body.data)).length, maxchunk);
                done();
            })
            .catch(done);
        });

        it('should reply with partial content partial content status code when maxchunk is smaller than buffersize ', function (done) {
            var data = new Buffer('busorsomething');
            var maxchunk = Math.floor(data.length / 2);
            d.mount('master', filetransfer.uploader({
                fetch: function (_id) {
                    return Promise.resolve(data);
                }
                , maxchunk: maxchunk
            }));
            d.mount(['error'], function (ctxt) {
                done(ctxt.body);
            });


            d.request(['master'], { _id: 'germany' }, { timeout: 1 })
            .spread(function (body, options) {
                assert.equal(options.statusCode, '206');
                done();
            })
            .catch(done);
        });

        it('should reply with full data length when maxchunk is smaller than buffersize ', function (done) {
            var data = new Buffer('busorsomething');
            var maxchunk = Math.floor(data.length / 2);
            d.mount('master', filetransfer.uploader({
                fetch: function (_id) {
                    return Promise.resolve(data);
                }
                , maxchunk: maxchunk
            }));
            d.mount(['error'], function (ctxt) {
                done(ctxt.body);
            });


            d.request(['master'], { _id: 'germany' }, { timeout: 1 })
            .spread(function (body) {
                assert.equal(body.dataLength, data.length);
                done();
            })
            .catch(done);
        });

        it('should reply with hash of full data length when maxchunk is smaller than buffersize ', function (done) {
            var data = new Buffer('busorsomething');
            var maxchunk = Math.floor(data.length / 2);
            d.mount('master', filetransfer.uploader({
                fetch: function (_id) {
                    return Promise.resolve(data);
                }
                , maxchunk: maxchunk
            }));
            d.mount(['error'], function (ctxt) {
                done(ctxt.body);
            });


            d.request(['master'], { _id: 'germany' }, { timeout: 1 })
            .spread(function (body) {
                assert.equal(body.hash, digest(data));
                done();
            })
            .catch(done);
        });

        it('should reply with partial content status code when maxchunk option is smaller than buffersize ', function (done) {
            var data = new Buffer('busorsomething');
            var maxchunk = Math.floor(data.length / 2);
            d.mount('master', filetransfer.uploader({
                fetch: function (_id) {
                    return Promise.resolve(data);
                }
                , maxchunk: 2 * data.length
            }));
            d.mount(['error'], function (ctxt) {
                done(ctxt.body);
            });


            d.request(['master'], { _id: 'germany' }, { timeout: 1, maxchunk: maxchunk })
            .spread(function (body, options) {
                assert.equal('206', options.statusCode);
                done();
            })
            .catch(done);
        });

    });

});
