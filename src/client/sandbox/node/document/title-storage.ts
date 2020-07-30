import nativeMethods from '../../native-methods-adapter';

const DEFAULT_TITLE_VALUE = '';

// NOTE: All properties that can affect the real document.title are sandboxed.
// Their values stored into the single internal property.
const INTERNAL_TITLE_PROP_NAME = 'hammerhead|document-title-storage|internal-prop-name'

export default class DocumentTitleStorage {
    private readonly _document: Document;

    public constructor(document: Document) {
        this._document = document;
    }

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

        if (!firstTitle)
            return DEFAULT_TITLE_VALUE;

        return this.getTitleElementPropertyValue(firstTitle);
    }

    public setValueForFirstTitleElementIfExists (value?: string): void {
        const firstTitle = this._getFirstTitleElement();

        if(!firstTitle)
            return;

        if(value === void 0)
            value = nativeMethods.titleElementTextGetter.call(firstTitle);

        this.setTitleElementPropertyValue(firstTitle, value);
    }

    private _getFirstTitleElement (): HTMLTitleElement | undefined {
        return this._document &&
            this._document.head &&
            nativeMethods.elementQuerySelector.call(this._document.head, 'title');
    }

    getTitle (): string {
        return this._getValueFromFirstTitleElement();
    }

    setTitle(value: string): void {
        value = String(value);

        this._ensureFirstTitleElementInHead(value);
        this.setValueForFirstTitleElementIfExists(value);
    }

    getTitleElementPropertyValue (element: HTMLTitleElement): string {
        return element[INTERNAL_TITLE_PROP_NAME] as string || DEFAULT_TITLE_VALUE;
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

