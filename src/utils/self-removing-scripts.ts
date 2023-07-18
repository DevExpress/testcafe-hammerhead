// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import SHADOW_UI_CLASSNAME from '../shadow-ui/class-name';
import INTERNAL_PROPS from '../processing/dom/internal-properties';

const CLEANUP_FORMATTING_REGEXP = /\n\s*|\/\*[\S\s]*?\*\//g;

function create (script: string): string {
    return `
        <script class="${ SHADOW_UI_CLASSNAME.selfRemovingScript }">
            (function () {
                var currentScript = document.currentScript;

                currentScript.parentNode.removeChild(currentScript);

                ${ script }
            })();
        </script>
    `.replace(CLEANUP_FORMATTING_REGEXP, '');
}

export default {
    iframeInit: create(`
        var parentHammerhead = null;

        if (!window["${ INTERNAL_PROPS.hammerhead }"])
            Object.defineProperty(window, "${ INTERNAL_PROPS.documentWasCleaned }", { value: true, configurable: true });

        try {
            parentHammerhead = window.parent["${ INTERNAL_PROPS.hammerhead }"];
        } catch(e) {}

        if (parentHammerhead)
            parentHammerhead.sandbox.onIframeDocumentRecreated(window.frameElement);
    `),

    onWindowRecreation: create(`
        var hammerhead = window["${ INTERNAL_PROPS.hammerhead }"];
        var sandbox    = hammerhead && hammerhead.sandbox;

        if (!sandbox) {
            try {
                sandbox = window.parent["${ INTERNAL_PROPS.hammerhead }"].sandboxUtils.backup.get(window);
            } catch(e) {}
        }

        if (sandbox) {
            Object.defineProperty(window, "${ INTERNAL_PROPS.documentWasCleaned }", { value: true, configurable: true });

            sandbox.node.mutation.onDocumentCleaned(window, document);

            /* NOTE: B234357 */
            sandbox.node.processNodes(null, document);
        }
    `),

    onBodyCreated: create(`
        if (window["${ INTERNAL_PROPS.hammerhead }"])
            window["${ INTERNAL_PROPS.hammerhead }"].sandbox.node.raiseBodyCreatedEvent();
    `),

    onOriginFirstTitleLoaded: create(`
        window["${ INTERNAL_PROPS.hammerhead }"].sandbox.node.onOriginFirstTitleElementInHeadLoaded();
    `),

    restoreStorages: create(`
        window.localStorage.setItem("%s", %s);
        window.sessionStorage.setItem("%s", %s);
    `),
};
