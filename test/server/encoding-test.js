'use strict';

const expect        = require('chai').expect;
const Promise       = require('pinkie');
const encodeContent = require('../../lib/processing/encoding').encodeContent;
const decodeContent = require('../../lib/processing/encoding').decodeContent;
const Charset       = require('../../lib/processing/encoding/charset');

describe('Content encoding', () => {
    const src = new Buffer('Answer to the Ultimate Question of Life, the Universe, and Everything.');

    it('Should encode and decode content', () => {
        function testConfiguration (encoding, charsetStr) {
            const charset = new Charset();

            charset.set(charsetStr, 2);

            return encodeContent(src, encoding, charset)
                .then(encoded => {
                    return decodeContent(encoded, encoding, charset);
                })
                .then(decoded => {
                    expect(decoded).eql(src.toString());
                });
        }

        return Promise.all([
            testConfiguration(null, 'utf8'),
            testConfiguration('gzip', 'utf8'),
            testConfiguration('deflate', 'utf8'),
            testConfiguration('deflate', 'win1251'),
            testConfiguration(null, 'iso-8859-1'),
            testConfiguration('br', 'utf8')
        ]);
    }).timeout(5000);

    it('Should handle decoding errors', () => {
        return decodeContent(src, 'deflate', 'utf-8')
            .catch(err => {
                expect(err).to.be.an('object');
            });
    });
});
