const CHARSET_RE      = /(?:^|;)\s*charset=(.+)(?:;|$)/i;
const META_CHARSET_RE = /charset ?= ?['"]?([^ ;"']*)['"]?/i;

// NOTE: HTTP 1.1 specifies ISO-8859-1 as a default charset
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

const CHARSETS = [
    'iso-8859-1', 'iso-8859-2', 'iso-8859-3', 'iso-8859-4',
    'iso-8859-5', 'iso-8859-6', 'iso-8859-7', 'iso-8859-8',
    'iso-8859-9', 'iso-8859-10', 'iso-8859-11', 'iso-8859-12',
    'iso-8859-13', 'iso-8859-14', 'iso-8859-15', 'iso-8859-16',
    'windows-1250', 'windows-1251', 'windows-1252', 'windows-1253',
    'windows-1254', 'windows-1255', 'windows-1256', 'windows-1257',
    'windows-1258', 'windows-874', 'windows-866', 'koi8-r',
    'koi8-u', 'utf-8', 'utf-16', 'utf-16le', 'utf-16be', 'utf-32',
    'shift-jis', 'x-euc', 'big5', 'euc-kr'
];


export default class Charset {
    constructor () {
        this.charset  = DEFAULT_CHARSET;
        this.priority = PRIORITY_LIST.DEFAULT;
    }

    static getNormalizedCharsetMapKey (charset) {
        return charset.replace(/-/g, '').toLowerCase();
    }

    static normalizeCharset (charset) {
        var key = charset && Charset.getNormalizedCharsetMapKey(charset);

        return Charset.normalizedCharsetsMap[key] || null;
    }

    static normalizedCharsetsMap = CHARSETS.reduce((charsetMap, charset) => {
        charsetMap[Charset.getNormalizedCharsetMapKey(charset)] = charset;
        return charsetMap;
    }, {});

    static bufferStartsWithBOM (resBuf, bom) {
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
            if (Charset.bufferStartsWithBOM(resBuf, CHARSET_BOM_LIST[i].bom))
                return this.set(CHARSET_BOM_LIST[i].charset, PRIORITY_LIST.BOM);
        }

        return false;
    }

    fromContentType (contentTypeHeader) {
        if (this.priority <= PRIORITY_LIST.CONTENT_TYPE) {
            var charsetMatch = contentTypeHeader && contentTypeHeader.match(CHARSET_RE);
            var charset      = charsetMatch && charsetMatch[1];

            return this.set(Charset.normalizeCharset(charset), PRIORITY_LIST.CONTENT_TYPE);
        }

        return false;
    }

    fromUrl (charsetFromUrl) {
        if (charsetFromUrl && this.priority <= PRIORITY_LIST.URL)
            return this.set(Charset.normalizeCharset(charsetFromUrl), PRIORITY_LIST.URL);

        return false;
    }

    // NOTE: parsing charset from meta-tags
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

            return this.set(Charset.normalizeCharset(charsetStr), PRIORITY_LIST.META);
        }

        return false;
    }
}
