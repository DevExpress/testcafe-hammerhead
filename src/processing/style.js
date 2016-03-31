// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------
/* eslint hammerhead/proto-methods: 2 */

import INTERNAL_ATTRS from '../processing/dom/internal-attributes';

const SOURCE_MAP_REG_EX              = /#\s*sourceMappingURL\s*=\s*[^\s]+(\s|\*\/)/i;
const CSS_URL_PROPERTY_VALUE_PATTERN = /(url\s*\(\s*)(?:(')([^\s']*)(')|(")([^\s"]*)(")|([^\s\)]*))(\s*\))|(@import\s+)(?:(')([^\s']*)(')|(")([^\s"]*)("))/g;

class StyleProcessor {
    constructor () {
        this.IS_STYLESHEET_PROCESSED_COMMENT = '/* stylesheet processed via hammerhead */';
    }

    process (css, urlReplacer, isStylesheetTable) {
        var isStyleSheetProcessingRegEx = new RegExp('^\\s*' +
                                                     this.IS_STYLESHEET_PROCESSED_COMMENT.replace(/\/|\*/g, '\\$&'));
        var isStylesheetProcessed       = isStyleSheetProcessingRegEx.test(css);

        if (typeof css === 'string' && !isStylesheetProcessed) {
            var prefix = isStylesheetTable ? this.IS_STYLESHEET_PROCESSED_COMMENT + '\n' : '';

            // NOTE: Replace the :hover pseudo-class.
            css = css.replace(/\s*:\s*hover(\W)/gi, '[' + INTERNAL_ATTRS.hoverPseudoClass + ']$1');

            // NOTE: Remove the ‘source map’ directive.
            css = css.replace(SOURCE_MAP_REG_EX, '$1');

            // NOTE: Replace URLs in CSS rules with proxy URLs.
            return prefix + this._replaceStylsheetUrls(css, urlReplacer);
        }

        return css;
    }

    cleanUp (css, parseProxyUrl) {
        if (typeof css === 'string') {
            css = css.replace(new RegExp('\\[' + INTERNAL_ATTRS.hoverPseudoClass + '\\](\\W)', 'ig'), ':hover$1');

            return this._replaceStylsheetUrls(css, url => {
                var parsedProxyUrl = parseProxyUrl(url);

                return parsedProxyUrl ? parsedProxyUrl.destUrl : url;
            });
        }

        return css;
    }

    _replaceStylsheetUrls (css, processor) {
        return css.replace(
            CSS_URL_PROPERTY_VALUE_PATTERN,
            (match, prefix1, openQuote1, url1, closeQuote1, openQuote2, url2, closeQuote2, url3, postfix,
             prefix2, openQuote3, url4, closeQuote3, openQuote4, url5, closeQuote4) => {
                var prefix     = prefix1 || prefix2;
                var openQuote  = openQuote1 || openQuote2 || openQuote3 || openQuote4 || '';
                var url        = url1 || url2 || url3 || url4 || url5;
                var closeQuote = closeQuote1 || closeQuote2 || closeQuote3 || closeQuote4 || '';

                postfix = postfix || '';

                return url ? prefix + openQuote + processor(url) + closeQuote + postfix : match;
            }
        );
    }
}

export default new StyleProcessor();
