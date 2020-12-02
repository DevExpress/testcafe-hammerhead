import INTERNAL_PROPS from '../processing/dom/internal-properties';
import createSelfRemovingScript from './create-self-removing-script';

const INIT_SCRIPT_FOR_IFRAME_TEMPLATE = createSelfRemovingScript(`
    var parentHammerhead = null;

    if (!window["${ INTERNAL_PROPS.hammerhead }"])
        Object.defineProperty(window, "${ INTERNAL_PROPS.documentWasCleaned }", { value: true, configurable: true });

    try {
        parentHammerhead = window.parent["${ INTERNAL_PROPS.hammerhead }"];
    } catch(e) {}

    if (parentHammerhead)
        parentHammerhead.sandbox.onIframeDocumentRecreated(window.frameElement);
`);

export default INIT_SCRIPT_FOR_IFRAME_TEMPLATE;
