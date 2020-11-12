import EventEmitter from '../../utils/event-emitter';

export default class NodeMutation extends EventEmitter {
    BEFORE_DOCUMENT_CLEANED_EVENT = 'hammerhead|event|before-document-cleaned';
    DOCUMENT_CLEANED_EVENT = 'hammerhead|event|document-cleaned';
    DOCUMENT_CLOSED_EVENT = 'hammerhead|event|document-closed';
    BODY_CONTENT_CHANGED_EVENT = 'hammerhead|event|body-content-changed';
    BODY_CREATED_EVENT = 'hammerhead|event|body-created';
    IFRAME_ADDED_TO_DOM_EVENT = 'hammerhead|event|iframe-added-to-dom';

    onIframeAddedToDOM (iframe: HTMLIFrameElement | HTMLFrameElement) {
        this.emit(this.IFRAME_ADDED_TO_DOM_EVENT, iframe);
    }

    onBeforeDocumentCleaned (document: Document) {
        this.emit(this.BEFORE_DOCUMENT_CLEANED_EVENT, document);
    }

    onDocumentCleaned (window: Window, document: Document) {
        this.emit(this.DOCUMENT_CLEANED_EVENT, { window, document });
    }

    onDocumentClosed (document: Document) {
        this.emit(this.DOCUMENT_CLOSED_EVENT, document);
    }

    onBodyContentChanged (element: HTMLBodyElement | HTMLHtmlElement) {
        this.emit(this.BODY_CONTENT_CHANGED_EVENT, element);
    }

    onBodyCreated (body: HTMLBodyElement) {
        this.emit(this.BODY_CREATED_EVENT, body);
    }
}
