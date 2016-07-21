import { getTopSameDomainWindow } from '../../utils/dom';

const NATIVE_METOD_ETALONS = 'hammerhead|native-methods|nativeMethodEtalons';

export function isDocumentMethsOverriden (doc, win) {
    var etalons = _getEtalons(doc, win);

    return doc.createElement.toString() !== etalons.document;
}

export function isElementMethsOverriden (doc, win) {
    var etalons = _getEtalons(doc, win);

    return doc.createElement('div').getAttribute.toString() !== etalons.element;
}

export function isWindowMethsOverriden (doc, win) {
    var etalon = _getEtalons(doc, win);

    return win.XMLHttpRequest.prototype.open.toString() !== etalon.window;
}

function _getEtalons (doc, win) {
    var topSameDomainWindow = getTopSameDomainWindow(win);
    var etalons             = topSameDomainWindow[NATIVE_METOD_ETALONS];

    if (!etalons) {
        etalons = {
            document: doc.createElement.toString(),
            element:  doc.createElement('div').getAttribute.toString(),
            window:   win.XMLHttpRequest.prototype.open.toString()
        };
        topSameDomainWindow[NATIVE_METOD_ETALONS] = etalons;
    }

    return etalons;
}
