var expect        = require('chai').expect;
var Promise       = require('es6-promise').Promise;
var encodeContent = require('../../lib/processing/encoding').encodeContent;
var decodeContent = require('../../lib/processing/encoding').decodeContent;
var Charset       = require('../../lib/processing/encoding/charset');

describe('Content encoding', function () {
    var src = new Buffer('Answer to the Ultimate Question of Life, the Universe, and Everything.');

    it('Should encode and decode content', function (done) {
        function testConfiguration (encoding, charsetStr) {
            var charset = new Charset();

            charset.set(charsetStr, 2);

            return encodeContent(src, encoding, charset)
                .then(function (encoded) {
                    return decodeContent(encoded, encoding, charset);
                })
                .then(function (decoded) {
                    expect(decoded).eql(src.toString());
                });
        }

        Promise
            .all([
                testConfiguration(null, 'utf8'),
                testConfiguration('gzip', 'utf8'),
                testConfiguration('deflate', 'utf8'),
                testConfiguration('deflate', 'win1251'),
                testConfiguration(null, 'iso-8859-1')
            ])
            .then(function () {
                done();
            })
            .catch(done);
    });

    it('Should handle decoding errors', function (done) {
        decodeContent(src, 'deflate', 'utf-8')
            .catch(function (err) {
                expect(err).to.be.an('object');
                done();
            });
    });
});
