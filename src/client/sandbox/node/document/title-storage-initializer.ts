import DocumentTitleStorage from './title-storage';
import settings from '../../../settings';
import nativeMethods from '../../native-methods';
import removeElement from '../../../utils/remove-element';

export default class DocumentTitleStorageInitializer {
    constructor (readonly storage: DocumentTitleStorage) {
        this.storage.on('titleElementAdded', () => this._processFirstTitleElement());
    }

    private _setProxiedTitleValue (): void {
        const { sessionId, windowId } = settings.get();
        const value                   = `${sessionId}*${windowId}`;

        nativeMethods.documentTitleSetter.call(this.storage.getDocument(), value);
    }

    private _processFirstTitleElement (): boolean {
        if (settings.nativeAutomation)
            return true;

        const firstTitle = this.storage.getFirstTitleElement();

        if (!firstTitle)
            return false;

        if (this.storage.isElementProcessed(firstTitle))
            return false;

        const value = nativeMethods.titleElementTextGetter.call(firstTitle);

        this.storage.setTitleElementPropertyValue(firstTitle, value);

        this._setProxiedTitleValue();

        return true;
    }

    onAttach (): void {
        this._processFirstTitleElement();
    }

    onPageTitleLoaded (): void {
        if (this._processFirstTitleElement())
            return;

        const firstTitle  = this.storage.getFirstTitleElement();
        const secondTitle = this.storage.getSecondTitleElement();

        if (!secondTitle)
            return;

        const pageOriginValue = nativeMethods.titleElementTextGetter.call(secondTitle);
        const serviceValue    = nativeMethods.titleElementTextGetter.call(firstTitle);

        nativeMethods.titleElementTextSetter.call(secondTitle, serviceValue);
        removeElement(firstTitle);
        this.storage.setTitleElementPropertyValue(secondTitle, pageOriginValue);
    }
}
