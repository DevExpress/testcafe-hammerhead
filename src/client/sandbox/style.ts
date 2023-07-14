import SandboxBase from './base';

import {
    overrideDescriptor,
    overrideFunction,
    overrideStringRepresentation,
} from '../utils/overriding';

import styleProcessor from './../../processing/style';
import { getProxyUrl, parseProxyUrl } from './../utils/url';
import { isFunction } from '../utils/types';
import settings from '../settings';

const CSS_STYLE_IS_PROCESSED = 'hammerhead|style|is-processed';
const CSS_STYLE_PROXY_OBJECT = 'hammerhead|style|proxy-object';
const CSS_STYLE_PROXY_TARGET = 'hammerhead|style|proxy-target';

export default class StyleSandbox extends SandboxBase {
    URL_PROPS: string[];
    DASHED_URL_PROPS: string[];
    FEATURES: any;

    constructor () {
        super();

        this.URL_PROPS        = ['background', 'backgroundImage', 'borderImage',
            'borderImageSource', 'listStyle', 'listStyleImage', 'cursor'];
        this.DASHED_URL_PROPS = StyleSandbox.generateDashedProps(this.URL_PROPS);
        this.FEATURES         = this.detectBrowserFeatures();
    }

    private static generateDashedProps (props) {
        const dashedProps = [];

        for (const prop of props) {
            const dashedProp = StyleSandbox.convertToDashed(prop);

            if (prop !== dashedProp)
                dashedProps.push(dashedProp);
        }

        return dashedProps;
    }

    private static convertToDashed (prop) {
        return prop.replace(/[A-Z]/g, '-$&').toLowerCase();
    }

    private detectBrowserFeatures () {
        const features: any = {};

        // NOTE: The CSS2Properties class is supported only in the Firefox
        // and its prototype contains all property descriptors
        // @ts-ignore
        features.css2PropertiesProtoContainsAllProps = !!window.CSS2Properties;

        features.cssStyleDeclarationProtoContainsUrlProps = this.nativeMethods.objectHasOwnProperty
            .call(window.CSSStyleDeclaration.prototype, 'background');

        features.cssStyleDeclarationProtoContainsDashedProps = this.nativeMethods.objectHasOwnProperty
            .call(window.CSSStyleDeclaration.prototype, 'background-image');

        features.cssStyleDeclarationContainsAllProps = features.cssStyleDeclarationProtoContainsUrlProps &&
            features.cssStyleDeclarationProtoContainsDashedProps;

        if (!features.css2PropertiesProtoContainsAllProps && !features.cssStyleDeclarationProtoContainsUrlProps) {
            const testDiv              = this.nativeMethods.createElement.call(document, 'div');
            let propertySetterIsCalled = false;
            const testDivDescriptor    = this.nativeMethods.objectGetOwnPropertyDescriptor
                // @ts-ignore
                .call(window.Object, testDiv.style, 'background');

            if (testDivDescriptor.configurable) {
                // eslint-disable-next-line no-restricted-properties
                delete testDivDescriptor.value;
                delete testDivDescriptor.writable;
                testDivDescriptor.set = () => {
                    propertySetterIsCalled = true;
                };

                this.nativeMethods.objectDefineProperty(testDiv.style, 'background', testDivDescriptor);

                testDiv.style.background = 'url';
            }

            // NOTE: A style instance contains all url properties.
            // They are non-configurable in Safari less than 11.1.
            // Their setter cannot be called in Safari 11.1.
            features.propsCannotBeOverridden =  !testDivDescriptor.configurable || !propertySetterIsCalled;
        }

        return features;
    }

    attach (window: Window & typeof globalThis) {
        super.attach(window);

        if (settings.nativeAutomation)
            return;

        this.overrideStyleInElement();

        if (this.FEATURES.css2PropertiesProtoContainsAllProps)
            this.overridePropsInCSS2Properties();
        else
            this.overridePropsInCSSStyleDeclaration();

        this.overrideCssTextInCSSStyleDeclaration();
        this.overrideInsertRuleInCSSStyleSheet();
        this.overrideGetPropertyValueInCSSStyleDeclaration();
        this.overrideSetPropertyInCSSStyleDeclaration();
        this.overrideRemovePropertyInCSSStyleDeclaration();

        // NOTE: We need to override context of all functions from the CSSStyleDeclaration prototype if we use the Proxy feature.
        // Can only call CSSStyleDeclaration.<function name> on instances of CSSStyleDeclaration
        // The error above occurs if functions will be called on a proxy instance.
        if (this.FEATURES.propsCannotBeOverridden)
            this.overrideCSSStyleDeclarationFunctionsCtx(window);
    }

    private overrideStyleInElement () {
        const nativeMethods = this.nativeMethods;
        const styleSandbox  = this;

        overrideDescriptor(this.window[nativeMethods.htmlElementStylePropOwnerName].prototype, 'style', {
            getter: this.FEATURES.css2PropertiesProtoContainsAllProps || this.FEATURES.cssStyleDeclarationContainsAllProps
                ? null
                : function (this: Window) {
                    const style = nativeMethods.htmlElementStyleGetter.call(this);

                    if (styleSandbox.FEATURES.propsCannotBeOverridden)
                        return styleSandbox.getStyleProxy(style);

                    return styleSandbox.processStyleInstance(style);
                },
            setter: nativeMethods.htmlElementStyleSetter ? function (this: Window, value) {
                const processedCss = styleProcessor.process(value, getProxyUrl);

                nativeMethods.htmlElementStyleSetter.call(this, processedCss);
            } : null,
        });
    }

    private processStyleInstance (style) {
        const isProcessed = style[CSS_STYLE_IS_PROCESSED];

        if (!isProcessed) {
            for (const prop of this.DASHED_URL_PROPS)
                this.overrideStyleInstanceProp(style, prop);

            if (!this.FEATURES.cssStyleDeclarationProtoContainsUrlProps) {
                for (const prop of this.URL_PROPS)
                    this.overrideStyleInstanceProp(style, prop);
            }

            this.nativeMethods.objectDefineProperty(style, CSS_STYLE_IS_PROCESSED, { value: true });
        }

        return style;
    }

    private overrideStyleInstanceProp (style, prop) {
        const nativeMethods = this.nativeMethods;
        const dashedProp    = StyleSandbox.convertToDashed(prop);

        overrideDescriptor(style, prop, {
            getter: function () {
                const value = nativeMethods.styleGetPropertyValue.call(this, dashedProp);

                return styleProcessor.cleanUp(value, parseProxyUrl);
            },
            setter: function (value) {
                if (typeof value === 'string')
                    value = styleProcessor.process(value, getProxyUrl);

                nativeMethods.styleSetProperty.call(this, dashedProp, value);
            },
        });
    }

    private getStyleProxy (style) {
        let proxyObject = style[CSS_STYLE_PROXY_OBJECT];

        if (!proxyObject) {
            proxyObject = new this.nativeMethods.Proxy(style, {
                get: (target, prop) => {
                    if (this.URL_PROPS.indexOf(prop) !== -1 || this.DASHED_URL_PROPS.indexOf(prop) !== -1)
                        return styleProcessor.cleanUp(target[prop], parseProxyUrl);

                    if (prop === CSS_STYLE_PROXY_TARGET)
                        return target;

                    return target[prop];
                },
                set: (target, prop, value) => {
                    if (this.URL_PROPS.indexOf(prop) !== -1 || this.DASHED_URL_PROPS.indexOf(prop) !== -1) {
                        if (typeof value === 'string')
                            value = styleProcessor.process(value, getProxyUrl);
                    }

                    target[prop] = value;

                    return true;
                },
            });

            this.nativeMethods.objectDefineProperty(style, CSS_STYLE_PROXY_OBJECT, { value: proxyObject });
        }

        return proxyObject;
    }

    private overridePropsInCSS2Properties () {
        for (const prop of this.URL_PROPS)
        // @ts-ignore
            this.overrideStyleProp(this.window.CSS2Properties.prototype, prop);

        for (const prop of this.DASHED_URL_PROPS)
        // @ts-ignore
            this.overrideStyleProp(this.window.CSS2Properties.prototype, prop);
    }

    private overridePropsInCSSStyleDeclaration () {
        if (this.FEATURES.cssStyleDeclarationProtoContainsUrlProps) {
            for (const prop of this.URL_PROPS)
                this.overrideStyleProp(this.window.CSSStyleDeclaration.prototype, prop);
        }
        if (this.FEATURES.cssStyleDeclarationProtoContainsDashedProps) {
            for (const prop of this.DASHED_URL_PROPS)
                this.overrideStyleProp(this.window.CSSStyleDeclaration.prototype, prop);
        }
    }

    private overrideStyleProp (proto, prop) {
        const nativeMethods = this.nativeMethods;
        const dashedProp    = StyleSandbox.convertToDashed(prop);

        overrideDescriptor(proto, prop, {
            getter: function () {
                const value = nativeMethods.styleGetPropertyValue.call(this, dashedProp);

                return styleProcessor.cleanUp(value, parseProxyUrl);
            },
            setter: function (value) {
                if (typeof value === 'string')
                    value = styleProcessor.process(value, getProxyUrl);

                nativeMethods.styleSetProperty.call(this, dashedProp, value);
            },
        });
    }

    private overrideCssTextInCSSStyleDeclaration () {
        const nativeMethods = this.nativeMethods;

        overrideDescriptor(this.window.CSSStyleDeclaration.prototype, 'cssText', {
            getter: function () {
                const cssText = nativeMethods.styleCssTextGetter.call(this);

                return styleProcessor.cleanUp(cssText, parseProxyUrl);
            },
            setter: function (value) {
                if (typeof value === 'string')
                    value = styleProcessor.process(value, getProxyUrl);

                nativeMethods.styleCssTextSetter.call(this, value);
            },
        });
    }

    private overrideInsertRuleInCSSStyleSheet () {
        const nativeMethods = this.nativeMethods;

        overrideFunction(this.window.CSSStyleSheet.prototype, 'insertRule', function (this: CSSStyleSheet, rule, index) {
            const newRule = styleProcessor.process(rule, getProxyUrl);

            return nativeMethods.styleInsertRule.call(this, newRule, index);
        });
    }

    private overrideGetPropertyValueInCSSStyleDeclaration () {
        const nativeMethods = this.nativeMethods;

        overrideFunction(this.window.CSSStyleDeclaration.prototype, 'getPropertyValue', function (this: CSSStyleDeclaration, ...args) {
            const value = nativeMethods.styleGetPropertyValue.apply(this, args);

            return styleProcessor.cleanUp(value, parseProxyUrl);
        });
    }

    private overrideSetPropertyInCSSStyleDeclaration () {
        const nativeMethods = this.nativeMethods;

        overrideFunction(this.window.CSSStyleDeclaration.prototype, 'setProperty', function (this: CSSStyleDeclaration, ...args) {
            const value = args[1];

            if (typeof value === 'string')
                args[1] = styleProcessor.process(value, getProxyUrl);

            return nativeMethods.styleSetProperty.apply(this, args);
        });
    }

    private overrideRemovePropertyInCSSStyleDeclaration () {
        const nativeMethods = this.nativeMethods;

        overrideFunction(this.window.CSSStyleDeclaration.prototype, 'removeProperty', function (this: CSSStyleDeclaration, ...args) {
            const oldValue = nativeMethods.styleRemoveProperty.apply(this, args);

            return styleProcessor.cleanUp(oldValue, parseProxyUrl);
        });
    }

    private overrideCSSStyleDeclarationFunctionsCtx (window: Window & typeof globalThis) {
        const styleDeclarationProto = window.CSSStyleDeclaration.prototype;

        for (const prop in styleDeclarationProto) {
            const nativeFn = this.nativeMethods.objectGetOwnPropertyDescriptor.call(window.Object, styleDeclarationProto, prop).value;// eslint-disable-line no-restricted-properties

            if (this.nativeMethods.objectHasOwnProperty.call(styleDeclarationProto, prop) &&
                isFunction(nativeFn)) {
                (styleDeclarationProto[prop] as unknown as Function) = function (this: Window) {
                    return nativeFn.apply(this[CSS_STYLE_PROXY_TARGET] || this, arguments);
                };

                // NOTE: we cannot use 'overrideFunction' here since the function may not exist
                overrideStringRepresentation(styleDeclarationProto[prop] as unknown as Function, nativeFn);
            }
        }
    }
}
