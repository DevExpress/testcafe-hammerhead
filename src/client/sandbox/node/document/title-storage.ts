import nativeMethods from '../../native-methods';

const DEFAULT_TITLE_VALUE      = '';

// NOTE: All properties that can affect the real document.title are sandboxed.
// Their values stored into the single internal property.
const INTERNAL_TITLE_PROP_NAME = 'hammerhead|document-title-storage|internal-prop-name'

export default class DocumentTitleStorage {
    private _document: Document;

    private _ensureFirstTitleElementInHead (value: string): void {
        const firstTitle = this._getFirstTitleElement();

        if (firstTitle)
            return;

        const titleElement = this._document.createElement('title');

        nativeMethods.titleElementTextSetter.call(titleElement, value);
        document.head.appendChild(titleElement);
    }

    private _getValueFromFirstTitleElement (): string | undefined {
        const firstTitle = this._getFirstTitleElement();

        return firstTitle && firstTitle[INTERNAL_TITLE_PROP_NAME];
    }

    private _setValueForFirstTitleElementIfExists (value?: string): void {
        const firstTitle = this._getFirstTitleElement();

        if(!firstTitle)
            return;

        if(value === void 0)
            value = nativeMethods.titleElementTextGetter.call(firstTitle);

        this.setTitleElementPropertyValue(firstTitle, value);
    }

    private _getFirstTitleElement (): HTMLTitleElement | undefined {
        return this._document.head && nativeMethods.elementQuerySelector.call(this._document.head, 'title');
    }

    init (document: Document): void {
        this._document = document;

        this._setValueForFirstTitleElementIfExists();
    }

    getTitle (): string {
        return this._getValueFromFirstTitleElement() || DEFAULT_TITLE_VALUE;
    }

    setTitle(value: string): void {
        value = String(value);

        this._ensureFirstTitleElementInHead(value);
        this._setValueForFirstTitleElementIfExists(value);
    }

    getTitleElementPropertyValue (element: HTMLTitleElement): string {
        return element[INTERNAL_TITLE_PROP_NAME];
    }

    setTitleElementPropertyValue (element: HTMLTitleElement, value: string): void {
        value = String(value);

        if (INTERNAL_TITLE_PROP_NAME in element)
            element[INTERNAL_TITLE_PROP_NAME] = value;
        else
            nativeMethods.objectDefineProperty(element, INTERNAL_TITLE_PROP_NAME, {
                value,
                writable: true
            });
    }
}

