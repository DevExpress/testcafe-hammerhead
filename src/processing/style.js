// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------
/* eslint hammerhead/proto-methods: 2 */

import reEscape from '../utils/regexp-escape';
import INTERNAL_ATTRS from '../processing/dom/internal-attributes';
import { isSpecialPage } from '../utils/url';

const SOURCE_MAP_RE                       = /#\s*sourceMappingURL\s*=\s*[^\s]+(\s|\*\/)/i;
const CSS_URL_PROPERTY_VALUE_PATTERN      = /(url\s*\(\s*)(?:(')([^\s']*)(')|(")([^\s"]*)(")|([^\s\)]*))(\s*\))|(@import\s+)(?:(')([^\s']*)(')|(")([^\s"]*)("))/g;
const STYLESHEET_PROCESSING_START_COMMENT = '/*hammerhead|stylesheet|start*/';
const STYLESHEET_PROCESSING_END_COMMENT   = '/*hammerhead|stylesheet|end*/';
const HOVER_PSEUDO_CLASS_RE               = /\s*:\s*hover(\W)/gi;
const PSEUDO_CLASS_RE                     = new RegExp(`\\[${ INTERNAL_ATTRS.hoverPseudoClass }\\](\\W)`, 'ig');
const IS_STYLE_SHEET_PROCESSED_RE         = new RegExp(`^\\s*${ reEscape(STYLESHEET_PROCESSING_START_COMMENT) }`, 'gi');
const STYLESHEET_PROCESSING_COMMENTS_RE   = new RegExp(`^\\s*${ reEscape(STYLESHEET_PROCESSING_START_COMMENT) }\n?|` +
                                                       `\n?${ reEscape(STYLESHEET_PROCESSING_END_COMMENT) }\\s*$`, 'gi');

class StyleProcessor {
    constructor () {
        this.STYLESHEET_PROCESSING_START_COMMENT = STYLESHEET_PROCESSING_START_COMMENT;
        this.STYLESHEET_PROCESSING_END_COMMENT   = STYLESHEET_PROCESSING_END_COMMENT;
    }

    process (css, urlReplacer, isStylesheetTable) {
        if (!css || typeof css !== 'string' || IS_STYLE_SHEET_PROCESSED_RE.test(css))
            return css;

        var prefix  = isStylesheetTable ? STYLESHEET_PROCESSING_START_COMMENT + '\n' : '';
        var postfix = isStylesheetTable ? '\n' + STYLESHEET_PROCESSING_END_COMMENT : '';

        // NOTE: Replace the :hover pseudo-class.
        css = css.replace(HOVER_PSEUDO_CLASS_RE, '[' + INTERNAL_ATTRS.hoverPseudoClass + ']$1');

        // NOTE: Remove the ‘source map’ directive.
        css = css.replace(SOURCE_MAP_RE, '$1');

        // NOTE: Replace URLs in CSS rules with proxy URLs.
        return prefix + this._replaceStylsheetUrls(css, urlReplacer) + postfix;
    }

    cleanUp (css, parseProxyUrl) {
        if (typeof css !== 'string')
            return css;

        css = css
            .replace(PSEUDO_CLASS_RE, ':hover$1')
            .replace(STYLESHEET_PROCESSING_COMMENTS_RE, '');

        return this._replaceStylsheetUrls(css, url => {
            var parsedProxyUrl = parseProxyUrl(url);

            return parsedProxyUrl ? parsedProxyUrl.destUrl : url;
        });
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

                var processedUrl = isSpecialPage(url) ? url : processor(url);

                return url ? prefix + openQuote + processedUrl + closeQuote + postfix : match;
            }
        );
    }
}

export default new StyleProcessor();
