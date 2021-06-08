import SandboxBase from '../base';
import MessageSandbox from '../event/message';
import settings from '../../settings';
import nativeMethods from '../native-methods';
import * as windowsStorage from '../windows-storage';
import getRandomInt16Value from '../../utils/get-random-int-16-value';
import * as domUtils from '../../utils/dom';
import * as urlUtils from '../../utils/url';
import { SPECIAL_BLANK_PAGE } from '../../../utils/url';
import { OpenedWindowInfo } from '../../../typings/client';
import DefaultTarget from './default-target';
import isKeywordTarget from '../../../utils/is-keyword-target';
import Listeners from '../event/listeners';
import INTERNAL_PROPS from '../../../processing/dom/internal-properties';
import getTopOpenerWindow from '../../utils/get-top-opener-window';
import { isIframeWindow } from '../../utils/dom';

const DEFAULT_WINDOW_PARAMETERS = 'width=500px, height=500px';
const STORE_CHILD_WINDOW_CMD    = 'hammerhead|command|store-child-window';

export default class ChildWindowSandbox extends SandboxBase {
    readonly WINDOW_OPENED_EVENT = 'hammerhead|event|window-opened';
    private _childWindows: Set<Window> | null;

    constructor (private readonly _messageSandbox: MessageSandbox,
        private readonly _listeners: Listeners) {
        super();
    }

    private static _shouldOpenInNewWindowOnElementAction (el: HTMLLinkElement | HTMLAreaElement | HTMLFormElement, defaultTarget: string): boolean {
        const hasDownloadAttribute = typeof nativeMethods.getAttribute.call(el, 'download') === 'string';

        if (hasDownloadAttribute)
            return false;

        const target = this._calculateTargetForElement(el);

        return this._shouldOpenInNewWindow(target, defaultTarget);
    }

    private static _shouldOpenInNewWindow (target: string, defaultTarget: string): boolean {
        target = target || defaultTarget;
        target = target.toLowerCase();

        if (isKeywordTarget(target))
            return target === '_blank';

        return !windowsStorage.findByName(target);
    }

    private _openUrlInNewWindow (url: string, windowName?: string, windowParams?: string, window?: Window): OpenedWindowInfo {
        const windowId = getRandomInt16Value().toString();

        windowParams = windowParams || DEFAULT_WINDOW_PARAMETERS;
        windowName   = windowName || windowId;

        const newPageUrl   = urlUtils.getPageProxyUrl(url, windowId);
        const targetWindow = window || this.window;
        const openedWindow = nativeMethods.windowOpen.call(targetWindow, newPageUrl, windowName, windowParams);

        this._tryToStoreChildWindow(openedWindow, getTopOpenerWindow());

        this.emit(this.WINDOW_OPENED_EVENT, { windowId, window: openedWindow });

        return { windowId, wnd: openedWindow };
    }

    private static _calculateTargetForElement (el: HTMLLinkElement | HTMLAreaElement | HTMLFormElement): string {
        const base = nativeMethods.querySelector.call(domUtils.findDocument(el), 'base');

        return el.target || base?.target;
    }

    handleClickOnLinkOrArea(el: HTMLLinkElement | HTMLAreaElement): void {
        if (!settings.get().allowMultipleWindows)
            return;

        this._listeners.initElementListening(el, ['click']);
        this._listeners.addInternalEventAfterListener(el, ['click'], e => {
            if (e.defaultPrevented)
                return;

            if (!ChildWindowSandbox._shouldOpenInNewWindowOnElementAction(el, DefaultTarget.linkOrArea))
                return;

            // TODO: need to check that specified 'area' are clickable (initiated new page opening)
            const url = nativeMethods.anchorHrefGetter.call(el);

            e.preventDefault();

            this._openNewWindowAfterAllEventHandlers(url, e);
        });
    }

    private _openNewWindowAfterAllEventHandlers (url, e) {
        let eventBubbledToTop  = false;
        let isDefaultPrevented = false;

        const openUrlInNewWindowIfNotPrevented = () => {
            eventBubbledToTop = true;

            nativeMethods.removeEventListener.call(window, 'click', openUrlInNewWindowIfNotPrevented);

            if (!isDefaultPrevented)
                this._openUrlInNewWindow(url);
        };

        nativeMethods.addEventListener.call(window, 'click', openUrlInNewWindowIfNotPrevented);

        // NOTE: additional attempt to open a new window if window.handler was prevented by
        // `stopPropagation` or `stopImmediatePropagation` methods
        const origPreventDefault = e.preventDefault;

        e.preventDefault = () => {
            isDefaultPrevented = true;

            return origPreventDefault.call(e);
        };

        setTimeout(() => {
            if (!eventBubbledToTop)
                openUrlInNewWindowIfNotPrevented();
        }, 0);
    }

    handleWindowOpen (window: Window, args: [string?, string?, string?, boolean?]): Window {
        const [url, target, parameters] = args;

        if (settings.get().allowMultipleWindows && ChildWindowSandbox._shouldOpenInNewWindow(target, DefaultTarget.windowOpen)) {
            const openedWindowInfo = this._openUrlInNewWindow(url, target, parameters, window);

            return openedWindowInfo.wnd;
        }

        return nativeMethods.windowOpen.apply(window, args);
    }

    _handleFormSubmitting (window: Window): void {
        if (!settings.get().allowMultipleWindows)
            return;

        this._listeners.initElementListening(window, ['submit']);
        this._listeners.addInternalEventBeforeListener(window, ['submit'], e => {
            if (!domUtils.isFormElement(e.target))
                return;

            const form = e.target;

            if (!ChildWindowSandbox._shouldOpenInNewWindowOnElementAction(form, DefaultTarget.form))
                return;

            const aboutBlankUrl = urlUtils.getProxyUrl(SPECIAL_BLANK_PAGE);
            const openedInfo    = this._openUrlInNewWindow(aboutBlankUrl);
            const formAction    = nativeMethods.formActionGetter.call(form);
            const newWindowUrl  = urlUtils.getPageProxyUrl(formAction, openedInfo.windowId);

            nativeMethods.formActionSetter.call(form, newWindowUrl);
            nativeMethods.formTargetSetter.call(form, openedInfo.windowId);

            // TODO: On hammerhead start we need to clean up the window.name
            // It's necessary for form submit.
            // Also we need clean up the form target to the original value.
        });
    }

    private _tryToStoreChildWindow (win: Window, topOpenerWindow: Window): boolean {
        try {
            topOpenerWindow[INTERNAL_PROPS.hammerhead].sandbox.childWindow.addWindow(win);

            return true;
        }
        catch (e) {
            return false;
        }
    }

    private _setupChildWindowCollecting (window: Window) {
        if (isIframeWindow(window))
            return;

        const topOpenerWindow = getTopOpenerWindow();

        if (window !== topOpenerWindow) {
            if (!this._tryToStoreChildWindow(window, topOpenerWindow))
                this._messageSandbox.sendServiceMsg({ cmd: STORE_CHILD_WINDOW_CMD }, topOpenerWindow);
        } else {
            this._childWindows = new Set();

            this._messageSandbox.on(this._messageSandbox.SERVICE_MSG_RECEIVED_EVENT, ({ message, source }) => {
                if (message.cmd === STORE_CHILD_WINDOW_CMD)
                    this._childWindows.add(source);
            });
        }
    }

    addWindow (win: Window) {
        this._childWindows.add(win);
    }

    getChildWindows (): Window[] {
        const childWindows = [];

        // eslint-disable-next-line hammerhead/proto-methods
        this._childWindows.forEach(win => {
            // NOTE: sort windows that can be closed
            if (win.parent)
                childWindows.push(win);
            else
                this._childWindows.delete(win);
        });

        return childWindows;
    }

    attach(window: Window & typeof globalThis): void {
        super.attach(window, window.document);
        this._handleFormSubmitting(window);
        this._setupChildWindowCollecting(window);
    }
}
