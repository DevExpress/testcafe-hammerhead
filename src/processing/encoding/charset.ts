import getEncodingName from './labels';
import { startsWith } from '../../utils/buffer';
import BUILTIN_HEADERS from '../../request-pipeline/builtin-header-names';
import { MetaInfo } from '../interfaces';

const CHARSET_RE      = /(?:^|;)\s*charset=(.+)(?:;|$)/i;
const META_CHARSET_RE = /charset ?= ?['"]?([^ ;"']*)['"]?/i;

// NOTE: HTTP 1.1 specifies ISO-8859-1 as the default charset
// (see: http://www.w3.org/International/O-HTTP-charset.en.php).
const DEFAULT_CHARSET = 'iso-8859-1';

interface CharsetBOM {
    charset: string;
    bom: Buffer;
}

const CHARSET_BOM_LIST: CharsetBOM[] = [
    {
        charset: 'utf-8',
        bom:     Buffer.from([0xEF, 0xBB, 0xBF]),
    },

    {
        charset: 'utf-16le',
        bom:     Buffer.from([0xFF, 0xFE]),
    },

    {
        charset: 'utf-16be',
        bom:     Buffer.from([0xFE, 0xFF]),
    },
];

enum CharsetPriority { // eslint-disable-line no-shadow
    BOM = 3,
    CONTENT_TYPE = 2,
    URL = 1,
    META = 1,
    DEFAULT = 0
}

export default class Charset {
    charset: string = DEFAULT_CHARSET;
    priority: CharsetPriority = CharsetPriority.DEFAULT;

    public set (charset: string, priority: CharsetPriority): boolean {
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
        return this.priority === CharsetPriority.BOM;
    }

    fromBOM (resBuf: Buffer) {
        for (let i = 0; i < CHARSET_BOM_LIST.length; i++) {
            if (startsWith(resBuf, CHARSET_BOM_LIST[i].bom))
                return this.set(CHARSET_BOM_LIST[i].charset, CharsetPriority.BOM);
        }

        return false;
    }

    fromContentType (contentTypeHeader: string) {
        if (this.priority <= CharsetPriority.CONTENT_TYPE) {
            const charsetMatch = contentTypeHeader && contentTypeHeader.match(CHARSET_RE);
            const charset      = charsetMatch && charsetMatch[1];

            if (!charset)
                return false;

            return this.set(getEncodingName(charset), CharsetPriority.CONTENT_TYPE);
        }

        return false;
    }

    fromUrl (charsetFromUrl: string) {
        if (charsetFromUrl && this.priority <= CharsetPriority.URL)
            return this.set(getEncodingName(charsetFromUrl), CharsetPriority.URL);

        return false;
    }

    // NOTE: Parsing charset from meta tags
    // www.whatwg.org/specs/web-apps/current-work/multipage/parsing.html#determining-the-character-encoding
    // Each <meta> descriptor should contain values of the "http-equiv", "content" and "charset" attributes.
    fromMeta (metas: MetaInfo[]) {
        if (this.priority < CharsetPriority.META && metas.length) {
            let needPragma = true;
            let charsetStr = '';

            metas.forEach(attrs => {
                const shouldParseFromContentAttr = needPragma && attrs.content && attrs.httpEquiv &&
                                                   attrs.httpEquiv.toLowerCase() === BUILTIN_HEADERS.contentType;

                if (shouldParseFromContentAttr) {
                    const charsetMatch = (attrs.content as string).match(META_CHARSET_RE);

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

            return this.set(getEncodingName(charsetStr), CharsetPriority.META);
        }

        return false;
    }
}
