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

                    try {
                        var hammerhead = window["${ INTERNAL_PROPS.hammerhead }"] || parent["${ INTERNAL_PROPS.hammerhead }"];
                        
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
