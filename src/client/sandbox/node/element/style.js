import SandboxBase from '../../base';
import { overrideDescriptor } from '../../../utils/property-overriding';
import styleProcessor from '../../../../processing/style';
import * as urlUtils from '../../../utils/url';

export default class StyleSandbox extends SandboxBase {
    attach (window) {
        super.attach(window);

        const nativeMethods = this.nativeMethods;

        overrideDescriptor(window.HTMLElement.prototype, 'style', {
            getter: null,
            setter: nativeMethods.htmlElementStyleSetter ? function (value) {
                const processedCss = styleProcessor.process(value, urlUtils.getProxyUrl);

                nativeMethods.htmlElementStyleSetter.call(this, processedCss);
            } : null
        });

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
    }
}
