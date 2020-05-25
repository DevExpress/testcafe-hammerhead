import nativeMethods from '../../native-methods';
import * as domUtils from '../../../utils/dom';

export default class DocumentTitleStorage {
    private _value: string = '';
    private _document: Document;

    private _getTitles (): HTMLTitleElement[] {
        if (!this._document.head)
            return [];

        return nativeMethods.elementQuerySelectorAll.call(this._document.head, 'title');
    }

    private _ensureFirstTitleElementInHead (value: string): void {
        const titles = this._getTitles();

        if (titles.length !== 0)
            return;

        const titleElement = this._document.createElement('title');

        nativeMethods.titleElementTextSetter.call(titleElement, value);
        document.head.appendChild(titleElement);
    }

    init (document: Document): void {
        this._value    = nativeMethods.documentTitleGetter.call(document);
        this._document = document;
    }

    updateFromFirstTitleElement (): void {
        const firstTitleElement = this._getTitles()[0];

        this._value = firstTitleElement && nativeMethods.titleElementTextGetter.call(firstTitleElement) || '';
    }

    isAffected (el: HTMLElement): boolean {
        if (!domUtils.isTitleElement(el))
            return false;

        if (!domUtils.isElementInDocument(el, this._document))
            return false;

        if (this._getTitles()[0] !== el)
            return false;

        return true;
    }

    getTitle (): string {
        return this._value;
    }

    setTitle(value: string): void {
        this._ensureFirstTitleElementInHead(value);

        this._value = value;
    }
}

