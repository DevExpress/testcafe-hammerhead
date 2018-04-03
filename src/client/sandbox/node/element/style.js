/*eslint-disable*/
import SandboxBase from '../../base';
import { overrideDescriptor, createOverriddenDescriptor } from '../../../utils/property-overriding';
import styleProcessor from '../../../../processing/style';
import * as urlUtils from '../../../utils/url';
import { parseProxyUrl } from '../../../utils/url';
import { getProxyUrl } from '../../../utils/url';

const CSS_STYLE_IS_PROCESSED = 'hammerhead|style|is-processed';

const stylePropertiesThatContainsUrl = ['background', 'backgroundImage', 'borderImage',
    'borderImageSource', 'listStyle', 'listStyleImage', 'cursor'];

function makeWithDash (prop) {
    return prop.replace(/[A-Z]/g, '-$&').toLowerCase();
}

const stylePropertiesThatContainsUrlWithDash = [];

for (const prop of stylePropertiesThatContainsUrl) {
    const processedProp = makeWithDash(prop);

    if (prop !== processedProp)
        stylePropertiesThatContainsUrlWithDash.push(processedProp);
}

export default class StyleSandbox extends SandboxBase {
    constructor () {
        super();

        this.stylePropertyClass = window.CSSStyleDeclaration || window.MSStyleCSSProperties || window.CSS2Property;

        this.cssStyleDeclarationHasPropDescriptors = this.nativeMethods.objectGetOwnPropertyDescriptor
            .call(window.Object, window.CSSStyleDeclaration.prototype, 'background')
    }

    _overrideStyleSheetProp (proto, prop) {
        const nativeMethods = this.nativeMethods;
        const propWithDash  = makeWithDash(prop);

        overrideDescriptor(proto, prop, {
            getter: function () {
                const value = nativeMethods.styleGetPropertyValue.call(this, propWithDash);

                return styleProcessor.cleanUp(value, urlUtils.parseProxyUrl);
            },
            setter: function (value) {
                if (typeof value === 'string')
                    value = styleProcessor.process(value, urlUtils.getProxyUrl);

                nativeMethods.styleSetProperty.call(this, propWithDash, value);
            }
        });
    }

    _overrideStyleSheetPropWithValue (style, prop) {
        const nativeMethods = this.nativeMethods;
        const propWithDash  = makeWithDash(prop);

        const descriptor = createOverriddenDescriptor(style, prop, {
            getter: function () {
                const value = nativeMethods.styleGetPropertyValue.call(this, propWithDash);

                return styleProcessor.cleanUp(value, urlUtils.parseProxyUrl);
            },
            setter: function (value) {
                if (typeof value === 'string')
                    value = styleProcessor.process(value, urlUtils.getProxyUrl);

                nativeMethods.styleSetProperty.call(this, propWithDash, value);
            }
        });

        delete descriptor.value;
        delete descriptor.writable;

        nativeMethods.objectDefineProperty.call(window.Object, style, prop, descriptor);
    }

    attach (window) {
        super.attach(window);

        const nativeMethods = this.nativeMethods;
        const styleSandbox  = this;

        overrideDescriptor(window.HTMLElement.prototype, 'style', {
            getter: window.CSS2Properties ? null : function () {
                const style       = nativeMethods.htmlElementStyleGetter.call(this);
                const isProcessed = style[CSS_STYLE_IS_PROCESSED];

                if (!isProcessed) {
                    for (const prop of stylePropertiesThatContainsUrlWithDash)
                        styleSandbox._overrideStyleSheetPropWithValue(style, prop);

                    // chrome
                    if (!styleSandbox.cssStyleDeclarationHasPropDescriptors) {
                        for (const prop of stylePropertiesThatContainsUrl)
                            styleSandbox._overrideStyleSheetPropWithValue(style, prop);
                    }

                    nativeMethods.objectDefineProperty.call(window.Object, style, CSS_STYLE_IS_PROCESSED, { value: true });
                }

                return style;
            },
            setter: nativeMethods.htmlElementStyleSetter ? function (value) {
                const processedCss = styleProcessor.process(value, urlUtils.getProxyUrl);

                nativeMethods.htmlElementStyleSetter.call(this, processedCss);
            } : null
        });

        if (window.CSS2Properties) {
            for (const prop of stylePropertiesThatContainsUrl)
                this._overrideStyleSheetProp(window.CSS2Properties.prototype, prop);

            for (const prop of stylePropertiesThatContainsUrlWithDash)
                this._overrideStyleSheetProp(window.CSS2Properties.prototype, prop);
        }
        else if (this.cssStyleDeclarationHasPropDescriptors) {
            for (const prop of stylePropertiesThatContainsUrl)
                this._overrideStyleSheetProp(window.CSSStyleDeclaration.prototype, prop);
        }

        overrideDescriptor(window.CSSStyleDeclaration.prototype, 'cssText', {
            getter: function () {
                const cssText = nativeMethods.styleCssTextGetter.call(this);

                return styleProcessor.cleanUp(cssText, urlUtils.parseProxyUrl);
            },
            setter: function (value) {
                if (typeof value === 'string')
                    value = styleProcessor.process(value, urlUtils.getProxyUrl);

                nativeMethods.styleCssTextSetter.call(this, value);
            }
        });

        this.stylePropertyClass.prototype.getPropertyValue = function (...args) {
            const value = nativeMethods.styleGetPropertyValue.apply(this, args);

            return styleProcessor.cleanUp(value, parseProxyUrl);
        };

        this.stylePropertyClass.prototype.setProperty = function (...args) {
            const value = args[1];

            if (typeof value === 'string')
                args[1] = styleProcessor.process(value, getProxyUrl);

            return nativeMethods.styleSetProperty.apply(this, args);
        };

        this.stylePropertyClass.prototype.removeProperty = function (...args) {
            const oldValue = nativeMethods.styleRemoveProperty.apply(this, args);

            return styleProcessor.cleanUp(oldValue, parseProxyUrl);
        };
    }
}
