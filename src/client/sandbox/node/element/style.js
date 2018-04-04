import SandboxBase from '../../base';
import { overrideDescriptor, createOverriddenDescriptor } from '../../../utils/property-overriding';
import styleProcessor from '../../../../processing/style';
import { getProxyUrl, parseProxyUrl } from '../../../utils/url';

const CSS_STYLE_IS_PROCESSED = 'hammerhead|style|is-processed';
const CSS_STYLE_PROXY_OBJECT = 'hammerhead|style|proxy-object';
const CSS_STYLE_PROXY_TARGET = 'hammerhead|style|proxy-target';

export default class StyleSandbox extends SandboxBase {
    constructor () {
        super();

        this.URL_PROPS        = ['background', 'backgroundImage', 'borderImage',
            'borderImageSource', 'listStyle', 'listStyleImage', 'cursor'];
        this.DASHED_URL_PROPS = StyleSandbox._generateDashedProps(this.URL_PROPS);

        // NOTE: The CSS2Properties class is supported only in the Firefox
        // and its prototype contains all property descriptors
        this.isProtoContainsAllProps = !!window.CSS2Properties;

        // NOTE: The CSSStyleDeclaration class contains not dashed url properties only in the IE
        this.isProtoContainsUrlDescriptors = this.nativeMethods.objectHasOwnProperty
            .call(window.CSSStyleDeclaration.prototype, 'background');

        // NOTE: A style instance contains all url properties and they are non-configurable in the Safari
        this.isPropsCannotBeOverridden = !this.isProtoContainsAllProps && !this.isProtoContainsUrlDescriptors &&
                                         !this.nativeMethods.objectGetOwnPropertyDescriptor
                                             .call(window.Object, document.documentElement.style, 'background').configurable;
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

        const descriptor = createOverriddenDescriptor(style, prop, {
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

        /*eslint-disable no-restricted-properties*/
        delete descriptor.value;
        /*eslint-enable no-restricted-properties*/
        delete descriptor.writable;

        nativeMethods.objectDefineProperty.call(window.Object, style, prop, descriptor);
    }

    _processStyleInstance (style) {
        const isProcessed = style[CSS_STYLE_IS_PROCESSED];

        if (!isProcessed) {
            for (const prop of this.DASHED_URL_PROPS)
                this._overrideStyleInstanceProp(style, prop);

            if (!this.isProtoContainsUrlDescriptors) {
                for (const prop of this.URL_PROPS)
                    this._overrideStyleInstanceProp(style, prop);
            }

            this.nativeMethods.objectDefineProperty.call(window.Object, style, CSS_STYLE_IS_PROCESSED, { value: true });
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

                    if (this.nativeMethods.objectHasOwnProperty.call(window.CSSStyleDeclaration.prototype, prop) &&
                        typeof target[prop] === 'function') {
                        return function (...args) {
                            return target[prop].apply(this[CSS_STYLE_PROXY_TARGET], args);
                        };
                    }

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

            this.nativeMethods.objectDefineProperty.call(window.Object, style, CSS_STYLE_PROXY_OBJECT, { value: proxyObject });
        }

        return proxyObject;
    }

    attach (window) {
        super.attach(window);

        const nativeMethods = this.nativeMethods;
        const styleSandbox  = this;

        overrideDescriptor(window.HTMLElement.prototype, 'style', {
            getter: this.isProtoContainsAllProps ? null : function () {
                const style = nativeMethods.htmlElementStyleGetter.call(this);

                if (styleSandbox.isPropsCannotBeOverridden)
                    return styleSandbox._getStyleProxy(style);

                return styleSandbox._processStyleInstance(style);
            },
            setter: nativeMethods.htmlElementStyleSetter ? function (value) {
                const processedCss = styleProcessor.process(value, getProxyUrl);

                nativeMethods.htmlElementStyleSetter.call(this, processedCss);
            } : null
        });

        if (this.isProtoContainsAllProps) {
            for (const prop of this.URL_PROPS)
                this._overrideStyleProp(window.CSS2Properties.prototype, prop);

            for (const prop of this.DASHED_URL_PROPS)
                this._overrideStyleProp(window.CSS2Properties.prototype, prop);
        }
        else if (this.isProtoContainsUrlDescriptors) {
            for (const prop of this.URL_PROPS)
                this._overrideStyleProp(window.CSSStyleDeclaration.prototype, prop);
        }

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

        window.CSSStyleDeclaration.prototype.getPropertyValue = function (...args) {
            const value = nativeMethods.styleGetPropertyValue.apply(this, args);

            return styleProcessor.cleanUp(value, parseProxyUrl);
        };

        window.CSSStyleDeclaration.prototype.setProperty = function (...args) {
            const value = args[1];

            if (typeof value === 'string')
                args[1] = styleProcessor.process(value, getProxyUrl);

            return nativeMethods.styleSetProperty.apply(this, args);
        };

        window.CSSStyleDeclaration.prototype.removeProperty = function (...args) {
            const oldValue = nativeMethods.styleRemoveProperty.apply(this, args);

            return styleProcessor.cleanUp(oldValue, parseProxyUrl);
        };
    }
}
