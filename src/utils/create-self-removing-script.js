// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import SHADOW_UI_CLASSNAME from '../shadow-ui/class-name';
import INTERNAL_PROPS from '../processing/dom/internal-properties';

export default function (script) {
    return `
        <script class="${ SHADOW_UI_CLASSNAME.selfRemovingScript }">
            (function () {
                ${ script }

                var currentScript = document.currentScript;

                /* NOTE: IE11 doesn't support the 'currentScript' property */
                if (!currentScript) {
                    var scripts;
                    var hammerhead;

                    try {
                        hammerhead = parent["${ INTERNAL_PROPS.hammerhead }"] || window["${ INTERNAL_PROPS.hammerhead }"];
                    }
                    catch (e) {
                        hammerhead = window["${ INTERNAL_PROPS.hammerhead }"];
                    }
                    
                    try {
                        scripts = hammerhead ? hammerhead.nativeMethods.documentScriptsGetter.call(document) : document.scripts;
                    } catch (e) {
                        scripts = document.scripts;
                    }

                    currentScript = scripts[scripts.length - 1];
                }

                currentScript.parentNode.removeChild(currentScript);
            })();
        </script>
    `.replace(/\n\s*|\/\*[\S\s]*?\*\//g, '');
}
