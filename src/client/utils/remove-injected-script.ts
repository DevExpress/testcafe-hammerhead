import nativeMethods from '../sandbox/native-methods';
import SHADOW_UI_CLASSNAME from '../../shadow-ui/class-name';
import removeElement from './remove-element';

const SCRIPT_SELECTOR = `.${SHADOW_UI_CLASSNAME.script}`;

export default function () {
    const injectedScript = nativeMethods.querySelector.call(document, SCRIPT_SELECTOR);

    if (injectedScript)
        removeElement(injectedScript);
}
