const { expect }                       = require('chai');
const { encodeContent, decodeContent } = require('../../lib/processing/encoding');
const Charset                          = require('../../lib/processing/encoding/charset');
const crypto                           = require('crypto');

describe('Content encoding', () => {
    const src = Buffer.from('Answer to the Ultimate Question of Life, the Universe, and Everything.');

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
            testConfiguration('br', 'utf8'),
        ]);
    }).timeout(5000);

    it('Should handle decoding errors', () => {
        return decodeContent(src, 'deflate', 'utf-8')
            .catch(err => {
                expect(err).to.be.an('object');
            });
    });

    it('Brotli decoding performance (GH-2743)', async () => {
        const charset = new Charset();

        charset.set('utf8', 2);

        const content = crypto.randomBytes(10 * 1000 * 1000).toString('hex');

        const start = Date.now();

        const encoded = await encodeContent(content, 'br', charset);

        await decodeContent(encoded, 'br', charset);

        const executionTime = Date.now() - start;

        expect(executionTime).below(5000);
    });
});
