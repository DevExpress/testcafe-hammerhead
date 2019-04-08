import EventEmiter from './utils/event-emitter';
import { parseProxyUrl } from '../utils/url';
import { isChangedOnlyHash } from './utils/url';
import { isShadowUIElement, isAnchorElement, isFormElement, closest } from './utils/dom';
import * as windowsStorage from './sandbox/windows-storage';
import DomProcessor from '../processing/dom';
import nextTick from './utils/next-tick';
import nativeMethods from './sandbox/native-methods';
import INTERNAL_PROPS from '../processing/dom/internal-properties';
/*eslint-disable no-unused-vars*/
import EventSandbox from './sandbox/event';
import CodeInstrumentation from './sandbox/code-instrumentation';
import ElementSandbox from './sandbox/node/element';
import { ElementSandboxBeforeFormSubmitEvent } from '../typings/client';
/*eslint-enable no-unused-vars*/

export default class PageNavigationWatch extends EventEmiter {
    PAGE_NAVIGATION_TRIGGERED_EVENT: string = 'hammerhead|event|page-navigation-triggered';

    _lastLocationValue: string;

    constructor (private readonly _eventSandbox: EventSandbox,               // eslint-disable-line
                 private readonly _codeInstrumentation: CodeInstrumentation, // eslint-disable-line
                 private readonly _elementSandbox: ElementSandbox) {         // eslint-disable-line
        super();

        this._lastLocationValue = window.location.toString();
    }

    _formWatch (elementSandbox: ElementSandbox, eventSandbox: EventSandbox): void {
        const onFormSubmit = (form: HTMLFormElement) => {
            const targetWindow = PageNavigationWatch._getTargetWindow(form);

            PageNavigationWatch._onNavigationTriggeredInWindow(targetWindow, nativeMethods.formActionGetter.call(form));
        };

        // NOTE: fires when form.submit() is called
        elementSandbox.on(elementSandbox.BEFORE_FORM_SUBMIT_EVENT, (e: ElementSandboxBeforeFormSubmitEvent) => onFormSubmit(e.form));

        // NOTE: fires when the form is submitted by clicking the submit button
        eventSandbox.listeners.initElementListening(window, ['submit']);
        eventSandbox.listeners.addInternalEventListener(window, ['submit'], (e: Event) => {
            let prevented = false;

            if (!isFormElement(e.target as HTMLElement))
                return;

            const onPreventDefault = (preventedEvent: Event) => {
                prevented = prevented || preventedEvent === e;
            };

            eventSandbox.on(eventSandbox.EVENT_PREVENTED_EVENT, onPreventDefault);

            nextTick()
                .then(() => {
                    eventSandbox.off(eventSandbox.EVENT_PREVENTED_EVENT, onPreventDefault);

                    // NOTE: the defaultPrevented flag is saved between event raises in all browsers
                    // except IE. In IE, it is reset to false before the next handler is executed.
                    if (!e.defaultPrevented && !prevented)
                        onFormSubmit(e.target as HTMLFormElement);
                });
        });
    }

    static _getTargetWindow (el: HTMLElement): Window {
        const target = nativeMethods.getAttribute.call(el, DomProcessor.getStoredAttrName('target')) ||
                       nativeMethods.getAttribute.call(el, 'target') ||
                       '_self';

        switch (target) {
            case '_top':
                return window.top;
            case '_parent':
                return window.parent;
            case '_self':
                return window;
            default:
                return windowsStorage.findByName(target);
        }
    }

    _linkWatch (eventSandbox: EventSandbox): void {
        eventSandbox.listeners.initElementListening(window, ['click']);
        eventSandbox.listeners.addInternalEventListener(window, ['click'], (e: Event) => {
            const link = isAnchorElement(e.target) ? e.target : closest(e.target, 'a');

            if (link && !isShadowUIElement(link)) {
                let prevented      = false;
                const targetWindow = PageNavigationWatch._getTargetWindow(link);
                const href         = nativeMethods.anchorHrefGetter.call(link);

                const onPreventDefault = (preventedEvent: Event) => {
                    prevented = prevented || preventedEvent === e;
                };

                eventSandbox.on(eventSandbox.EVENT_PREVENTED_EVENT, onPreventDefault);

                nextTick()
                    .then(() => {
                        eventSandbox.off(eventSandbox.EVENT_PREVENTED_EVENT, onPreventDefault);

                        // NOTE: the defaultPrevented flag is saved between event raises in all browsers
                        // except IE. In IE, it is reset to false before the next handler is executed.
                        if (!e.defaultPrevented && !prevented)
                            PageNavigationWatch._onNavigationTriggeredInWindow(targetWindow, href);
                    });
            }
        });
    }

    _locationWatch (codeInstrumentation: CodeInstrumentation): void {
        const locationAccessorsInstrumentation = codeInstrumentation._locationAccessorsInstrumentation;
        const locationChangedHandler           = (newLocation: string) => this.onNavigationTriggered(newLocation);

        locationAccessorsInstrumentation.on(locationAccessorsInstrumentation.LOCATION_CHANGED_EVENT, locationChangedHandler);
    }

    static _onNavigationTriggeredInWindow (win: Window, url: string): void {
        try {
            //@ts-ignore
            win[INTERNAL_PROPS.hammerhead].pageNavigationWatch.onNavigationTriggered(url);
        }
        // eslint-disable-next-line no-empty
        catch (e) {
        }
    }

    onNavigationTriggered (url: string): void {
        const currentLocation = this._lastLocationValue;

        this._lastLocationValue = window.location.toString();

        if (url !== currentLocation && (url.charAt(0) === '#' || isChangedOnlyHash(currentLocation, url)) ||
            DomProcessor.isJsProtocol(url))
            return;

        const parsedProxyUrl = parseProxyUrl(url);

        if (!parsedProxyUrl)
            return;

        this.emit(this.PAGE_NAVIGATION_TRIGGERED_EVENT, parsedProxyUrl.destUrl);
    }

    start (): void {
        this._locationWatch(this._codeInstrumentation);
        this._linkWatch(this._eventSandbox);
        this._formWatch(this._elementSandbox, this._eventSandbox);
    }
}
