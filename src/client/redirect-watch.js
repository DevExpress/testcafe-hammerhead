import EventEmiter from './utils/event-emitter';
import { parseProxyUrl } from '../utils/url';
import ElementSandbox from './sandbox/node/element';
import * as windowsStorage from './sandbox/windows-storage';
import domProcessor from './dom-processor/index';
import { isAnchorElement } from './utils/dom';
import nativeMethods from './sandbox/native-methods';

const HASH_RE = /#.*$/;

export default class RedirectWatch extends EventEmiter {
    constructor (listeners, codeInstrumentation, elementSandbox) {
        super();

        this.REDIRECT_DETECTED_EVENT = 'hammerhead|event|redirect-detected';

        this.lastLocationValue     = window.location.toString();
        this.redirectActions       = [];
        this.cancelRedirectActions = [];

        this._locationWatch(codeInstrumentation);
        this._linkWatch(elementSandbox, listeners);
        this._formWatch(elementSandbox, listeners);
    }

    _formWatch (elementSandbox, listeners) {
        elementSandbox.on(elementSandbox.BEFORE_FORM_SUBMIT, e => {
            if (e.form.action) {
                var targetWindow = this._getTargetWindow(e.form);

                this._windowRedirectAction(targetWindow, e.form.action, e.form);
            }
        });

        listeners.on(listeners.EVENT_DEFAULT_PREVENTED, e => {
            if (e.evt.type === 'submit' && e.evt.target.action) {
                var form         = e.evt.target;
                var targetWindow = this._getTargetWindow(form);

                this._windowRedirectAction(targetWindow, form.action, form, true);
            }
        });
    }

    _windowRedirectAction (window, url, el, isCanceled) {
        try {
            var redirectWatch = window['%hammerhead%'].redirectWatch;

            if (isCanceled)
                redirectWatch.cancelRedirect(url, el);
            else
                redirectWatch.redirect(url, el);
        }
            /*eslint-disable no-empty */
        catch (e) {
        }
        /*eslint-enable no-empty */
    }

    _getTargetWindow (el) {
        var targetWindow = window;
        var target       = nativeMethods.getAttribute.call(el, domProcessor.getStoredAttrName('target')) ||
                           nativeMethods.getAttribute.call(el, 'target');

        if (target) {
            if (!ElementSandbox._isKeywordTarget(target))
                targetWindow = windowsStorage.findByName(target) || window;
            else if (target === '_top')
                targetWindow = window.top;
            else if (target === '_parent')
                targetWindow = window.parent;
        }

        return targetWindow;
    }

    _linkWatch (elementSandbox, listeners) {
        elementSandbox.on(elementSandbox.LINK_CLICKED, e => {
            var link = e.el;

            if (link.href) {
                var targetWindow = this._getTargetWindow(link);

                this._windowRedirectAction(targetWindow, link.href, e.evt.target);
            }
        });

        listeners.on(listeners.EVENT_DEFAULT_PREVENTED, e => {
            /*eslint-disable no-sequences */
            if (e.evt.type === 'click') {
                var currEl = e.evt.target;

                do {
                    if (isAnchorElement(currEl)) {
                        var targetWindow = this._getTargetWindow(currEl);

                        if (currEl.href) {
                            this._windowRedirectAction(targetWindow, currEl.href, e.evt.target, true);

                            return;
                        }
                    }
                } while (currEl !== e.el, currEl = currEl.parentElement);
            }
            /*eslint-enable no-sequences */
        });
    }

    _locationWatch (codeInstrumentation) {
        var locationAccessorsInstrumentation = codeInstrumentation.locationAccessorsInstrumentation;
        var propertyAccessorsInstrumentation = codeInstrumentation.propertyAccessorsInstrumentation;

        var locationChangedHandler = newLocation => this.redirect(newLocation, void 0, true);

        locationAccessorsInstrumentation.on(locationAccessorsInstrumentation.LOCATION_CHANGED_EVENT, locationChangedHandler);
        propertyAccessorsInstrumentation.on(propertyAccessorsInstrumentation.LOCATION_CHANGED_EVENT, locationChangedHandler);
    }

    _neutralizeCanceledRedirections (url, el, isCanceled) {
        var targetActions  = isCanceled ? this.redirectActions : this.cancelRedirectActions;
        var inverseActions = isCanceled ? this.cancelRedirectActions : this.redirectActions;

        for (var i = 0; i < targetActions.length; i++) {
            if (targetActions[i].el === el && targetActions[i].url === url) {
                targetActions.splice(i, 1);

                return true;
            }
        }

        inverseActions.push({ el, url });

        return false;
    }

    _takeLastRedirect () {
        return this.redirectActions.length ? this.redirectActions.pop() : null;
    }

    cancelRedirect (url, el) {
        this._neutralizeCanceledRedirections(url, el, true);
    }

    redirect (url, el, force) {
        var currentLocation = this.lastLocationValue;

        this.lastLocationValue = window.location.toString();

        if (url !== currentLocation && url.replace(HASH_RE, '') === currentLocation.replace(HASH_RE, ''))
            return;

        if (this._neutralizeCanceledRedirections(url, el))
            return;

        var raiseDetectedEvent = () => {
            var lastRedirect = this._takeLastRedirect();

            if (lastRedirect) {
                var parsedUrl = parseProxyUrl(lastRedirect.url);

                if (parsedUrl)
                    this.emit(this.REDIRECT_DETECTED_EVENT, parsedUrl.destUrl);
            }
        };

        if (force)
            raiseDetectedEvent();
        else
            nativeMethods.setTimeout.call(window, raiseDetectedEvent, 0);
    }
}
