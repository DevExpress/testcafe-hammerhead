import nativeMethods from '../sandbox/native-methods';
import SHADOW_UI_CLASSNAME from '../../shadow-ui/class-name';
import removeElement from './remove-element';

const HEAD_SCRIPT_SELECTOR = `head > script.${SHADOW_UI_CLASSNAME.script}`;

export default function () {
    const hammerheadHeadScript = nativeMethods.querySelector.call(document, HEAD_SCRIPT_SELECTOR);

    if (hammerheadHeadScript)
        removeElement(hammerheadHeadScript);
}
