import nativeMethods from '../../native-methods';
import EventEmitter from '../../../utils/event-emitter';

const DEFAULT_TITLE_VALUE = '';

// NOTE: Hammehead always add the <title> element for each test before test execution.
// It's necessary to TestCafe can find the browser tab by page title.
// This <title> element stores the sandboxed title value in the internal property.
const INTERNAL_TITLE_PROP_NAME = 'hammerhead|document-title-storage|internal-prop-name';

export default class DocumentTitleStorage extends EventEmitter {
    private readonly _document: Document;

    public constructor (document: Document) {
        super();

        this._document = document;
    }

    private _ensureFirstTitleElement (): HTMLTitleElement {
        let firstTitle = this.getFirstTitleElement();

        if (firstTitle)
            return firstTitle;

        firstTitle = nativeMethods.createElement.call(this._document, 'title') as HTMLTitleElement;

        nativeMethods.appendChild.call(this._document.head, firstTitle);

        this.emit('titleElementAdded');

        return firstTitle;
    }

    private _getValueFromFirstTitleElement (): string {
        const firstTitle = this.getFirstTitleElement();

        if (!firstTitle)
            return DEFAULT_TITLE_VALUE;

        return this.getTitleElementPropertyValue(firstTitle);
    }

    private _setValueForFirstTitleElement (value: string): void {
        const firstTitle = this._ensureFirstTitleElement();

        this.setTitleElementPropertyValue(firstTitle, value);
    }

    private _getTitleElement (index: number): HTMLTitleElement | undefined {
        return this._document &&
            this._document.head &&
            nativeMethods.elementQuerySelectorAll.call(this._document.head, 'title')[index];
    }

    public getFirstTitleElement (): HTMLTitleElement | undefined {
        return this._getTitleElement(0);
    }

    public getSecondTitleElement (): HTMLTitleElement | undefined {
        return this._getTitleElement(1);
    }

    getTitle (): string {
        return this._getValueFromFirstTitleElement();
    }

    setTitle (value: string): void {
        value = String(value);

        this._setValueForFirstTitleElement(value);
    }

    getTitleElementPropertyValue (element: HTMLTitleElement): string {
        return element[INTERNAL_TITLE_PROP_NAME] as string || DEFAULT_TITLE_VALUE;
    }

    setTitleElementPropertyValue (element: HTMLTitleElement, value: string): void {
        value = String(value);

        if (this.isElementProcessed(element))
            element[INTERNAL_TITLE_PROP_NAME] = value;
        else {
            nativeMethods.objectDefineProperty(element, INTERNAL_TITLE_PROP_NAME, {
                value,
                writable: true,
            });
        }
    }

    public getDocument () {
        return this._document;
    }

    public isElementProcessed (titleElement: HTMLTitleElement): boolean {
        return INTERNAL_TITLE_PROP_NAME in titleElement;
    }

    public static get DEFAULT_TITLE_VALUE (): string {
        return DEFAULT_TITLE_VALUE;
    }
}

