// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import SHADOW_UI_CLASSNAME from '../shadow-ui/class-name';
import INTERNAL_PROPS from '../processing/dom/internal-properties';

export default function (script: string): string {
    return `
        <script class="${ SHADOW_UI_CLASSNAME.selfRemovingScript }">
            (function () {
                ${ script }

                var currentScript = document.currentScript;
                var scriptsLength;
                var scripts;

                /* NOTE: IE11 doesn't support the 'currentScript' property */
                if (!currentScript) {
                    var hammerhead;

                    try {
                        hammerhead = parent["${ INTERNAL_PROPS.hammerhead }"] || window["${ INTERNAL_PROPS.hammerhead }"];
                    }
                    catch (e) {
                        hammerhead = window["${ INTERNAL_PROPS.hammerhead }"];
                    }

                    if (hammerhead) {
                        try {
                            scripts       = hammerhead.nativeMethods.documentScriptsGetter.call(document);
                            scriptsLength = hammerhead.nativeMethods.htmlCollectionLengthGetter.call(scripts);
                        }
                        catch (e) {}
                    }

                    scripts       = scripts || document.scripts;
                    scriptsLength = scriptsLength !== void 0 ? scriptsLength : scripts.length;
                    currentScript = scripts[scriptsLength - 1];
                }

                currentScript.parentNode.removeChild(currentScript);
            })();
        </script>
    `.replace(/\n\s*|\/\*[\S\s]*?\*\//g, '');
}
