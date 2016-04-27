import getEncodingName from './labels';

const CHARSET_RE      = /(?:^|;)\s*charset=(.+)(?:;|$)/i;
const META_CHARSET_RE = /charset ?= ?['"]?([^ ;"']*)['"]?/i;

// NOTE: HTTP 1.1 specifies ISO-8859-1 as the default charset
// (see: http://www.w3.org/International/O-HTTP-charset.en.php).
const DEFAULT_CHARSET = 'iso-8859-1';

const CHARSET_BOM_LIST = [
    {
        charset: 'utf-8',
        bom:     [0xEF, 0xBB, 0xBF]
    },

    {
        charset: 'utf-16le',
        bom:     [0xFF, 0xFE]
    },

    {
        charset: 'utf-16be',
        bom:     [0xFE, 0xFF]
    }
];

const PRIORITY_LIST = {
    BOM:          3,
    CONTENT_TYPE: 2,
    URL:          1,
    META:         1,
    DEFAULT:      0
};

// Charset
export default class Charset {
    constructor () {
        this.charset  = DEFAULT_CHARSET;
        this.priority = PRIORITY_LIST.DEFAULT;
    }

    static _bufferStartsWithBOM (resBuf, bom) {
        if (resBuf.length < bom.length)
            return false;

        for (var i = 0; i < bom.length; i++) {
            if (resBuf[i] !== bom[i])
                return false;
        }

        return true;
    }

    set (charset, priority) {
        if (charset && this.charset !== charset && this.priority <= priority) {
            this.charset  = charset;
            this.priority = priority;

            return true;
        }

        return false;
    }

    get () {
        return this.charset;
    }

    isFromBOM () {
        return this.priority === PRIORITY_LIST.BOM;
    }

    fromBOM (resBuf) {
        for (var i = 0; i < CHARSET_BOM_LIST.length; i++) {
            if (Charset._bufferStartsWithBOM(resBuf, CHARSET_BOM_LIST[i].bom))
                return this.set(CHARSET_BOM_LIST[i].charset, PRIORITY_LIST.BOM);
        }

        return false;
    }

    fromContentType (contentTypeHeader) {
        if (this.priority <= PRIORITY_LIST.CONTENT_TYPE) {
            var charsetMatch = contentTypeHeader && contentTypeHeader.match(CHARSET_RE);
            var charset      = charsetMatch && charsetMatch[1];

            return this.set(getEncodingName(charset), PRIORITY_LIST.CONTENT_TYPE);
        }

        return false;
    }

    fromUrl (charsetFromUrl) {
        if (charsetFromUrl && this.priority <= PRIORITY_LIST.URL)
            return this.set(getEncodingName(charsetFromUrl), PRIORITY_LIST.URL);

        return false;
    }

    // NOTE: Parsing charset from meta tags
    // www.whatwg.org/specs/web-apps/current-work/multipage/parsing.html#determining-the-character-encoding
    // Each <meta> descriptor should contain values of the "http-equiv", "content" and "charset" attributes.
    fromMeta (metas) {
        if (this.priority < PRIORITY_LIST.META && metas.length) {
            var needPragma = null;
            var charsetStr = null;

            metas.forEach(attrs => {
                var shouldParseFromContentAttr = needPragma !== false &&
                                                 attrs.content &&
                                                 attrs.httpEquiv &&
                                                 attrs.httpEquiv.toLowerCase() === 'content-type';

                if (shouldParseFromContentAttr) {
                    var charsetMatch = attrs.content.match(META_CHARSET_RE);

                    if (charsetMatch) {
                        needPragma = true;
                        charsetStr = charsetMatch[1];
                    }
                }

                if (attrs.charset) {
                    needPragma = false;
                    charsetStr = attrs.charset;
                }
            });

            return this.set(getEncodingName(charsetStr), PRIORITY_LIST.META);
        }

        return false;
    }
}
