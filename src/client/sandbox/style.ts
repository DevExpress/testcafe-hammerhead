import SandboxBase from './base';
import { overrideDescriptor, overrideFunction } from './../utils/property-overriding';
import styleProcessor from './../../processing/style';
import { getProxyUrl, parseProxyUrl } from './../utils/url';

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
        this.DASHED_URL_PROPS = StyleSandbox._generateDashedProps(this.URL_PROPS);
        this.FEATURES         = this._detectBrowserFeatures();
    }

    static _convertToDashed (prop) {
        return prop.replace(/[A-Z]/g, '-$&').toLowerCase();
    }

    static _generateDashedProps (props) {
        const dashedProps = [];

        for (const prop of props) {
            const dashedProp = StyleSandbox._convertToDashed(prop);

            if (prop !== dashedProp)
                dashedProps.push(dashedProp);
        }

        return dashedProps;
    }

    _detectBrowserFeatures () {
        const features: any = {};

        // NOTE: The CSS2Properties class is supported only in the Firefox
        // and its prototype contains all property descriptors
        // @ts-ignore
        features.protoContainsAllProps = !!window.CSS2Properties;

        // NOTE: The CSSStyleDeclaration class contains not dashed url properties only in the IE
        features.protoContainsUrlProps = this.nativeMethods.objectHasOwnProperty
            // @ts-ignore
            .call(window.CSSStyleDeclaration.prototype, 'background');

        if (!features.protoContainsAllProps && !features.protoContainsUrlProps) {
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

    _overrideStyleProp (proto, prop) {
        const nativeMethods = this.nativeMethods;
        const dashedProp    = StyleSandbox._convertToDashed(prop);

        overrideDescriptor(proto, prop, {
            getter: function () {
                const value = nativeMethods.styleGetPropertyValue.call(this, dashedProp);

                return styleProcessor.cleanUp(value, parseProxyUrl);
            },
            setter: function (value) {
                if (typeof value === 'string')
                    value = styleProcessor.process(value, getProxyUrl);

                nativeMethods.styleSetProperty.call(this, dashedProp, value);
            }
        });
    }

    _overrideStyleInstanceProp (style, prop) {
        const nativeMethods = this.nativeMethods;
        const dashedProp    = StyleSandbox._convertToDashed(prop);

        overrideDescriptor(style, prop, {
            getter: function () {
                const value = nativeMethods.styleGetPropertyValue.call(this, dashedProp);

                return styleProcessor.cleanUp(value, parseProxyUrl);
            },
            setter: function (value) {
                if (typeof value === 'string')
                    value = styleProcessor.process(value, getProxyUrl);

                nativeMethods.styleSetProperty.call(this, dashedProp, value);
            }
        });
    }

    _processStyleInstance (style) {
        const isProcessed = style[CSS_STYLE_IS_PROCESSED];

        if (!isProcessed) {
            for (const prop of this.DASHED_URL_PROPS)
                this._overrideStyleInstanceProp(style, prop);

            if (!this.FEATURES.protoContainsUrlProps) {
                for (const prop of this.URL_PROPS)
                    this._overrideStyleInstanceProp(style, prop);
            }

            this.nativeMethods.objectDefineProperty(style, CSS_STYLE_IS_PROCESSED, { value: true });
        }

        return style;
    }

    _getStyleProxy (style) {
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
                }
            });

            this.nativeMethods.objectDefineProperty(style, CSS_STYLE_PROXY_OBJECT, { value: proxyObject });
        }

        return proxyObject;
    }

    _overrideCSSStyleDeclarationFunctionsCtx (window: Window) {
        // @ts-ignore
        const styleDeclarationProto = window.CSSStyleDeclaration.prototype;

        for (const prop in styleDeclarationProto) {
            // @ts-ignore
            const nativeFn = this.nativeMethods.objectGetOwnPropertyDescriptor.call(window.Object, styleDeclarationProto, prop).value;// eslint-disable-line no-restricted-properties

            if (this.nativeMethods.objectHasOwnProperty.call(styleDeclarationProto, prop) &&
                typeof nativeFn === 'function') {
                const nativeFnWrapper = function () {
                    return nativeFn.apply(this[CSS_STYLE_PROXY_TARGET] || this, arguments);
                };

                overrideFunction(styleDeclarationProto, prop, nativeFnWrapper);
            }
        }
    }

    attach (window: Window & typeof globalThis) {
        super.attach(window);

        const nativeMethods = this.nativeMethods;
        const styleSandbox  = this;

        overrideDescriptor(window[nativeMethods.htmlElementStylePropOwnerName].prototype, 'style', {
            getter: this.FEATURES.protoContainsAllProps ? null : function () {
                const style = nativeMethods.htmlElementStyleGetter.call(this);

                if (styleSandbox.FEATURES.propsCannotBeOverridden)
                    return styleSandbox._getStyleProxy(style);

                return styleSandbox._processStyleInstance(style);
            },
            setter: nativeMethods.htmlElementStyleSetter ? function (value) {
                const processedCss = styleProcessor.process(value, getProxyUrl);

                nativeMethods.htmlElementStyleSetter.call(this, processedCss);
            } : null
        });

        if (this.FEATURES.protoContainsAllProps) {
            for (const prop of this.URL_PROPS)
                // @ts-ignore
                this._overrideStyleProp(window.CSS2Properties.prototype, prop);

            for (const prop of this.DASHED_URL_PROPS)
                // @ts-ignore
                this._overrideStyleProp(window.CSS2Properties.prototype, prop);
        }
        else if (this.FEATURES.protoContainsUrlProps) {
            for (const prop of this.URL_PROPS)
                // @ts-ignore
                this._overrideStyleProp(window.CSSStyleDeclaration.prototype, prop);
        }

        // @ts-ignore
        overrideDescriptor(window.CSSStyleDeclaration.prototype, 'cssText', {
            getter: function () {
                const cssText = nativeMethods.styleCssTextGetter.call(this);

                return styleProcessor.cleanUp(cssText, parseProxyUrl);
            },
            setter: function (value) {
                if (typeof value === 'string')
                    value = styleProcessor.process(value, getProxyUrl);

                nativeMethods.styleCssTextSetter.call(this, value);
            }
        });

        const insertRuleWrapper = function (rule, index) {
            const newRule = styleProcessor.process(rule, getProxyUrl);

            return nativeMethods.styleInsertRule.call(this, newRule, index);
        };

        overrideFunction((window as any).CSSStyleSheet.prototype, 'insertRule', insertRuleWrapper);

        const getPropertyValueWrapper = function (...args) {
            const value = nativeMethods.styleGetPropertyValue.apply(this, args);

            return styleProcessor.cleanUp(value, parseProxyUrl);
        };

        overrideFunction((window as any).CSSStyleDeclaration.prototype, 'getPropertyValue', getPropertyValueWrapper);

        const setPropertyWrapper = function (...args) {
            const value = args[1];

            if (typeof value === 'string')
                args[1] = styleProcessor.process(value, getProxyUrl);

            return nativeMethods.styleSetProperty.apply(this, args);
        };

        overrideFunction((window as any).CSSStyleDeclaration.prototype, 'setProperty', setPropertyWrapper);

        const removePropertyWrapper = function (...args) {
            const oldValue = nativeMethods.styleRemoveProperty.apply(this, args);

            return styleProcessor.cleanUp(oldValue, parseProxyUrl);
        };

        overrideFunction((window as any).CSSStyleDeclaration.prototype, 'removeProperty', removePropertyWrapper);

        // NOTE: We need to override context of all functions from the CSSStyleDeclaration prototype if we use the Proxy feature.
        // Can only call CSSStyleDeclaration.<function name> on instances of CSSStyleDeclaration
        // The error above occurs if functions will be called on a proxy instance.
        if (this.FEATURES.propsCannotBeOverridden)
            this._overrideCSSStyleDeclarationFunctionsCtx(window);
    }
}
