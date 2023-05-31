// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------
/* eslint hammerhead/proto-methods: 2 */

import reEscape from '../utils/regexp-escape';
import INTERNAL_ATTRS from '../processing/dom/internal-attributes';
import { isSpecialPage } from '../utils/url';
import { URL_ATTR_TAGS } from './dom/attributes';
import DomProcessor from './dom';
import { Dictionary } from '../typings/common';

const arrayJoin  = Array.prototype.join;
const objectKeys = Object.keys;

function getTagsString (tagsDict: Dictionary<string[]>) {
    const tags: string[] = [];

    for (const key in tagsDict) {
        for (const tag of tagsDict[key])
            tags.push(tag);
    }

    return arrayJoin.call(tags).replace(/,/g, '|');
}

const SOURCE_MAP_RE                       = /\/\*\s*[#@]\s*sourceMappingURL\s*=[\s\S]*?\*\/|\/\/[\t ]*[#@][\t ]*sourceMappingURL[\t ]*=.*/ig;
const CSS_URL_PROPERTY_VALUE_RE           = /(url\s*\(\s*(['"]?))([^\s]*?)(\2\s*\))|(@import\s+(['"]))([^\s]*?)(\6)/g;
const TAGS_STRING                         = getTagsString(URL_ATTR_TAGS);
const ATTRS_STRING                        = arrayJoin.call(objectKeys(URL_ATTR_TAGS), '|');
const ATTRIBUTE_SELECTOR_RE               = new RegExp(`(([#.])?(?:${TAGS_STRING})\\[\\s*)(${ATTRS_STRING})(\\s*(?:\\^)?=)`, 'g');
const STYLESHEET_PROCESSING_START_COMMENT = '/*hammerhead|stylesheet|start*/';
const STYLESHEET_PROCESSING_END_COMMENT   = '/*hammerhead|stylesheet|end*/';
const HOVER_PSEUDO_CLASS_RE               = /:\s*hover(\W)/gi;
const PSEUDO_CLASS_RE                     = new RegExp(`\\[${ INTERNAL_ATTRS.hoverPseudoClass }\\](\\W)`, 'ig');
const IS_STYLE_SHEET_PROCESSED_RE         = new RegExp(`\\s*${ reEscape(STYLESHEET_PROCESSING_START_COMMENT) }`, 'gi');
const STYLESHEET_PROCESSING_COMMENTS_RE   = new RegExp(`${ reEscape(STYLESHEET_PROCESSING_START_COMMENT) }\n?|` +
                                                       `\n?${ reEscape(STYLESHEET_PROCESSING_END_COMMENT) }\\s*`, 'gi');

class StyleProcessor {
    STYLESHEET_PROCESSING_START_COMMENT = STYLESHEET_PROCESSING_START_COMMENT;
    STYLESHEET_PROCESSING_END_COMMENT = STYLESHEET_PROCESSING_END_COMMENT;

    nativeAutomation = false;

    process (css: string, urlReplacer: Function, shouldIncludeProcessingComments?: boolean): string {
        if (!css || typeof css !== 'string' || shouldIncludeProcessingComments && IS_STYLE_SHEET_PROCESSED_RE.test(css))
            return css;

        // NOTE: Replace the :hover pseudo-class.
        css = css.replace(HOVER_PSEUDO_CLASS_RE, '[' + INTERNAL_ATTRS.hoverPseudoClass + ']$1');

        // NOTE: Remove all 'source map' directives.
        css = css.replace(SOURCE_MAP_RE, '');

        // NOTE: Replace URLs in CSS rules with proxy URLs.
        if (!this.nativeAutomation)
            css = this._replaceStylesheetUrls(css, urlReplacer);

        // NOTE: Replace url attributes to stored attributes
        css = this._replaceUrlAttributes(css);

        if (shouldIncludeProcessingComments)
            css = `${STYLESHEET_PROCESSING_START_COMMENT}\n${css}\n${STYLESHEET_PROCESSING_END_COMMENT}`;

        return css;
    }

    cleanUp (css: string, parseProxyUrl: Function): string {
        if (typeof css !== 'string')
            return css;

        css = css
            .replace(PSEUDO_CLASS_RE, ':hover$1')
            .replace(INTERNAL_ATTRS.storedAttrPostfix, '');

        css = this._removeStylesheetProcessingComments(css);

        if (!this.nativeAutomation) {
            css = this._replaceStylesheetUrls(css, (url: string) => {
                const parsedProxyUrl = parseProxyUrl(url);

                return parsedProxyUrl ? parsedProxyUrl.destUrl : url;
            });
        }

        return css;
    }

    private _removeStylesheetProcessingComments (css: string): string {
        const parts                = css.split(STYLESHEET_PROCESSING_COMMENTS_RE);
        const stylesheetPartsFound = parts.length >= 3;

        if (!stylesheetPartsFound)
            return css;

        for (let i = 0; i < parts.length; i += 2) {
            let whiteSpaceCount = 0;

            // NOTE: search for whitespaces from the end of the string
            // we do not use /\s*$/ regex intentionally to improve performance
            for (let j = parts[i].length - 1; j >= 0; j--) {
                if (!(/\s/.test(parts[i][j]))) // eslint-disable-line @typescript-eslint/no-extra-parens
                    break;

                whiteSpaceCount++;
            }

            parts[i] = parts[i].substring(0, parts[i].length - whiteSpaceCount);
        }


        return arrayJoin.call(parts, '');
    }

    private _replaceStylesheetUrls (css: string, processor: Function): string {
        return css.replace(CSS_URL_PROPERTY_VALUE_RE, (match, prefix1, _q1, url1, postfix1, prefix2, _q2, url2, postfix2) => {
            const prefix       = prefix1 || prefix2;
            const url          = url1 || url2;
            const processedUrl = isSpecialPage(url) ? url : processor(url);
            const postfix      = postfix1 || postfix2;

            return url ? prefix + processedUrl + postfix : match;
        });
    }

    private _replaceUrlAttributes (css: string): string {
        return css.replace(ATTRIBUTE_SELECTOR_RE, (match, prefix, prev, attribute, postfix) => {
            if (prev === '.' || prev === '#')
                return match;

            return prefix + DomProcessor.getStoredAttrName(attribute) + postfix;
        });
    }
}

export default new StyleProcessor();
