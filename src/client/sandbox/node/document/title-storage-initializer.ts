import DocumentTitleStorage from './title-storage';
import settings from '../../../settings';
import nativeMethods from '../../native-methods';
import removeElement from '../../../utils/remove-element';

export default class DocumentTitleStorageInitializer {
    constructor(private readonly _titleStorage: DocumentTitleStorage){}

    private _setProxiedTitleValue (): void {
        const { sessionId, windowId } = settings.get();
        const value                   = `${sessionId}*${windowId}`;

        nativeMethods.documentTitleSetter.call(this._titleStorage.getDocument(), value);
    }

    processFirstTitleElement ({ useDefaultValue } = { useDefaultValue: false }): boolean {
        const firstTitle = this._titleStorage.getFirstTitleElement();

        if (!firstTitle)
            return false;

        if (this._titleStorage.isElementProcessed(firstTitle))
            return false;

        const value = useDefaultValue ? DocumentTitleStorage.DEFAULT_TITLE_VALUE : nativeMethods.titleElementTextGetter.call(firstTitle);

        this._titleStorage.setTitleElementPropertyValue(firstTitle, value);

        if (!useDefaultValue)
            this._setProxiedTitleValue();

        return true;
    }

    onAttach (): void {
        this.processFirstTitleElement();
    }

    onPageTitleLoaded (): void {
        if (this.processFirstTitleElement())
            return;

        const firstTitle = this._titleStorage.getFirstTitleElement();
        const secondTitle = this._titleStorage.getSecondTitleElement();

        if (!secondTitle)
            return;

        // NOTE: IE11 returns an empty string for the second <title> tag in the elements hierarchy.
        const pageOriginValue =
            nativeMethods.titleElementTextGetter.call(secondTitle) ||
            nativeMethods.htmlElementInnerTextGetter.call(secondTitle);

        const serviceValue = nativeMethods.titleElementTextGetter.call(firstTitle);

        nativeMethods.titleElementTextSetter.call(secondTitle, serviceValue);
        removeElement(firstTitle);
        this._titleStorage.setTitleElementPropertyValue(secondTitle, pageOriginValue);
    }
}
