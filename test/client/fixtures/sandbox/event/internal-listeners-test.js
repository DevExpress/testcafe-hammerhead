var Listeners = hammerhead.get('./sandbox/event/listeners');

var browserUtils  = hammerhead.utils.browser;
var domUtils      = hammerhead.utils.dom;
var listeners     = hammerhead.sandbox.event.listeners;
var iframeSandbox = hammerhead.sandbox.iframe;

var containerCaptureEventRaised = false;
var containerBubbleEventRaised  = false;
var elementCaptureEventRaised   = false;
var elementBubbleEventRaised    = false;
var uiElementCaptureEventRaised = false;
var uiElementBubbleEventRaised  = false;

var $container = null;
var container  = null;
var $input     = null;
var input      = null;
var $uiElement = null;
var uiElement  = null;

var containerCaptureHandler = function () {
    containerCaptureEventRaised = true;
};

var containerBubbleHandler = function () {
    containerBubbleEventRaised = true;
};

var elementCaptureHandler = function () {
    elementCaptureEventRaised = true;
};

var elementBubbleHandler = function () {
    elementBubbleEventRaised = true;
};

var uiElementCaptureHandler = function () {
    uiElementCaptureEventRaised = true;
};

var uiElementBubbleHandler = function () {
    uiElementBubbleEventRaised = true;
};

var bindAll = function (event) {
    container.addEventListener(event, containerCaptureHandler, true);
    container.addEventListener(event, containerBubbleHandler, false);
    input.addEventListener(event, elementCaptureHandler, true);
    input.addEventListener(event, elementBubbleHandler, false);
    uiElement.addEventListener(event, uiElementCaptureHandler, true);
    uiElement.addEventListener(event, uiElementBubbleHandler, false);
};

var dispatchEvent = function (el, type) {
    var ev = document.createEvent('MouseEvents');

    ev.initMouseEvent(type, true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, el);

    el.dispatchEvent(ev);
};

var dispatchPointerEvent = function (el, type) {
    var pointEvent = browserUtils.isIE11 ? document.createEvent('PointerEvent') : document.createEvent('MSPointerEvent');

    pointEvent.initPointerEvent(type, true, true, window, 0, 0,
        0, 0, 0, false, false, false, false, 0, null, 0, 0, 0, 0, 0.5, 0, 0, 0, 1, 'mouse', Date.now(), true);

    el.dispatchEvent(pointEvent);
};

QUnit.testStart(function () {
    containerCaptureEventRaised = false;
    containerBubbleEventRaised  = false;
    elementCaptureEventRaised   = false;
    elementBubbleEventRaised    = false;
    uiElementCaptureEventRaised = false;
    uiElementBubbleEventRaised  = false;

    $container = $('<div>').appendTo('body');
    container  = $container[0];
    $input     = $('<input>').appendTo($container);
    input      = $input[0];
    $uiElement = $('<div>').appendTo($container);
    uiElement  = $uiElement[0];

    iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    $container.remove();
    $input.remove();
    $uiElement.remove();

    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);
});

test('initElementListening', function () {
    var event                = 'click';
    var firstHandlerCounter  = 0;
    var secondHandlerCounter = 0;
    var thirdHandlerCounter  = 0;
    var fourthHandlerCounter = 0;

    var firstHandler = function () {
        firstHandlerCounter++;
    };

    var secondHandler = function () {
        secondHandlerCounter++;
    };

    var thirdHandler = function () {
        thirdHandlerCounter++;
    };

    var fourthHandler = function () {
        fourthHandlerCounter++;
    };

    listeners.initElementListening(container, [event]);

    listeners.addInternalEventListener(container, [event], function () {
    });

    function checkHandlerCounters (first, second, third, fourth) {
        strictEqual(firstHandlerCounter, first);
        strictEqual(secondHandlerCounter, second);
        strictEqual(thirdHandlerCounter, third);
        strictEqual(fourthHandlerCounter, fourth);
    }

    // NOTE: Because of T233158 - Wrong test run for a mouse click in IE
    // there should be different handlers.
    container.addEventListener(event, firstHandler, true);
    container.addEventListener(event, secondHandler);
    container.addEventListener(event, thirdHandler, true);
    container.addEventListener(event, fourthHandler, false);

    dispatchEvent(container, event);

    checkHandlerCounters(1, 1, 1, 1);

    container.removeEventListener(event, firstHandler, true);
    container.removeEventListener(event, fourthHandler);

    dispatchEvent(container, event);

    checkHandlerCounters(1, 2, 2, 1);

    container.removeEventListener(event, secondHandler, false);
    container.removeEventListener(event, thirdHandler, true);

    dispatchEvent(container, event);

    checkHandlerCounters(1, 2, 2, 1);
});

test('stop propagation', function () {
    var event = 'focus';

    var testStopPropagation = function (e, dispatched, preventEvent, cancelHandlers, stopPropagation) {
        strictEqual(e.type, event);
        stopPropagation();
    };

    listeners.initElementListening(container, [event]);
    listeners.addInternalEventListener(container, [event], testStopPropagation);
    bindAll(event);

    notEqual(domUtils.getActiveElement(), input);
    input.focus();

    ok(!containerCaptureEventRaised);
    ok(!containerBubbleEventRaised);
    ok(!elementCaptureEventRaised);
    ok(!elementBubbleEventRaised);

    strictEqual(domUtils.getActiveElement(), input);
});

test('add wrapper', function () {
    var event = 'click';

    var onclick1 = function () {
        strictEqual(this, input);
    };

    var clickListenersWrapper = function (e, originListener) {
        originListener.call(input, e);
    };

    listeners.setEventListenerWrapper(container, [event], clickListenersWrapper);
    container.addEventListener(event, onclick1, true);

    expect(1);

    dispatchEvent(container, event);
});

module('prevent event');

test('preventer added before listener', function () {
    var event              = 'click';
    var preventEventRaised = false;

    var testPreventEvent = function (e, dispatched, preventEvent) {
        strictEqual(e.type, event);
        preventEventRaised = true;
        preventEvent();
    };

    listeners.initElementListening(container, [event]);
    listeners.addInternalEventListener(container, [event], testPreventEvent);
    bindAll(event);
    dispatchEvent(input, event);

    ok(preventEventRaised);
    ok(!containerCaptureEventRaised);
    ok(!containerBubbleEventRaised);
    ok(!elementCaptureEventRaised);
    ok(!elementBubbleEventRaised);

    preventEventRaised = false;
    listeners.removeInternalEventListener(container, [event], testPreventEvent);
    dispatchEvent(input, event);

    ok(!preventEventRaised);
    ok(containerCaptureEventRaised);
    ok(containerBubbleEventRaised);
    ok(elementCaptureEventRaised);
    ok(elementBubbleEventRaised);
});

test('preventer added after listener', function () {
    var event              = 'click';
    var preventEventRaised = false;

    var testPreventEvent = function (e, dispatched, preventEvent) {
        strictEqual(e.type, event);
        preventEventRaised = true;
        preventEvent();
    };

    listeners.initElementListening(container, [event]);
    bindAll(event);
    listeners.addInternalEventListener(container, [event], testPreventEvent);
    dispatchEvent(input, event);

    ok(preventEventRaised);
    ok(!containerCaptureEventRaised);
    ok(!containerBubbleEventRaised);
    ok(!elementCaptureEventRaised);
    ok(!elementBubbleEventRaised);
});

test('append several handlers', function () {
    var event1              = 'click';
    var event2              = 'mousedown';
    var handler1Raised      = false;
    var handler2Raised      = false;
    var preventEventCounter = 0;

    var handler1 = function () {
        handler1Raised = true;
    };

    var handler2 = function () {
        handler2Raised = true;
    };

    var testPreventEvent = function (e, dispatched, preventEvent) {
        preventEventCounter++;
        preventEvent();
    };

    listeners.initElementListening(container, [event1, event2]);
    listeners.addInternalEventListener(container, [event1], handler1);
    listeners.addInternalEventListener(container, [event1], testPreventEvent);
    listeners.addInternalEventListener(container, [event1], handler2);
    listeners.addInternalEventListener(container, [event2], testPreventEvent);

    bindAll(event1);
    bindAll(event2);

    dispatchEvent(input, event1);
    dispatchEvent(input, event2);

    strictEqual(preventEventCounter, 2);
    ok(handler1Raised);
    ok(!handler2Raised);
    ok(!containerCaptureEventRaised);
    ok(!containerBubbleEventRaised);
    ok(!elementCaptureEventRaised);
    ok(!elementBubbleEventRaised);
});

module('cancel handlers');

test('canceller added after listener', function () {
    var event                = 'click';
    var cancelHandlersRaised = false;

    var testCancelHandlers = function (e, dispatched, preventEvent, cancelHandlers) {
        strictEqual(e.type, event);
        cancelHandlersRaised = true;
        cancelHandlers();
    };

    listeners.initElementListening(container, [event]);
    bindAll(event);
    listeners.addInternalEventListener(container, [event], testCancelHandlers);
    dispatchEvent(uiElement, event);

    ok(cancelHandlersRaised);
    ok(!containerCaptureEventRaised);
    ok(!containerBubbleEventRaised);
    ok(!elementCaptureEventRaised);
    ok(!elementBubbleEventRaised);
    ok(uiElementCaptureEventRaised);
    ok(uiElementBubbleEventRaised);

    listeners.removeInternalEventListener(container, [event], testCancelHandlers);
});

module('regression');

test('ie service handlers should be ignored (GH-379)', function () {
    var ieServiceHandlerMock = {
        toString: function () {
            return '[object FunctionWrapper]';
        }
    };

    var listenerWrapper = Listeners._getEventListenerWrapper({}, ieServiceHandlerMock);

    strictEqual(listenerWrapper(), null);
});

test('only one of several handlers must be called (document handlers) (T233158)', function () {
    var event               = 'click';
    var clickHandlerCounter = 0;

    var clickHandler = function () {
        clickHandlerCounter++;
    };

    listeners.initElementListening(document, [event]);

    listeners.addInternalEventListener(document, [event], function () {
    });

    var $document = $(document);

    document.addEventListener(event, clickHandler, true);
    document.addEventListener(event, clickHandler, true);
    document.addEventListener(event, clickHandler, true);
    dispatchEvent(document, event);
    strictEqual(clickHandlerCounter, 1);

    document.removeEventListener(event, clickHandler, true);
    dispatchEvent(document, event);
    strictEqual(clickHandlerCounter, 1);

    $document.bind('click', clickHandler);
    $document.bind('click', clickHandler);
    dispatchEvent(document, event);
    strictEqual(clickHandlerCounter, 3);

    $document.unbind('click', clickHandler);
    dispatchEvent(document, event);
    strictEqual(clickHandlerCounter, 3);

    $document.on('click', clickHandler);
    $document.on('click', clickHandler);
    dispatchEvent(document, event);
    strictEqual(clickHandlerCounter, 5);

    $document.off('click', clickHandler);
    dispatchEvent(document, event);
    strictEqual(clickHandlerCounter, 5);

    document.addEventListener(event, clickHandler, true);
    $document.bind('click', clickHandler);
    $document.on('click', clickHandler);
    dispatchEvent(document, event);
    strictEqual(clickHandlerCounter, 8);
    document.removeEventListener(event, clickHandler, true);
    $document.unbind('click', clickHandler);
    $document.off('click', clickHandler);

    document.addEventListener(event, clickHandler, true);
    document.addEventListener(event, clickHandler, false);
    dispatchEvent(document, event);
    strictEqual(clickHandlerCounter, 10);

    document.removeEventListener(event, clickHandler, true);
    document.removeEventListener(event, clickHandler, false);
});

test('only one of several handlers must be called (body handlers) (T233158)', function () {
    var event               = 'click';
    var clickHandlerCounter = 0;

    var clickHandler = function () {
        clickHandlerCounter++;
    };

    listeners.initElementListening(document, [event]);

    listeners.addInternalEventListener(document, [event], function () {
    });

    document.body.addEventListener(event, clickHandler, true);
    document.body.addEventListener(event, clickHandler, true);
    document.body.addEventListener(event, clickHandler, false);

    var $body = $('body');

    $body.bind('click', clickHandler);
    $body.bind('click', clickHandler);
    $body.on('click', clickHandler);
    $body.on('click', clickHandler);

    dispatchEvent(document.body, event);
    strictEqual(clickHandlerCounter, 6);

    document.body.removeEventListener(event, clickHandler, true);
    document.body.removeEventListener(event, clickHandler, false);
    $body.unbind('click', clickHandler);
    $body.off('click', clickHandler);
});

test('only one of several handlers must be called (element handlers) (T233158)', function () {
    var event               = 'click';
    var clickHandlerCounter = 0;

    var clickHandler = function () {
        clickHandlerCounter++;
    };

    listeners.initElementListening(document, [event]);

    listeners.addInternalEventListener(document, [event], function () {
    });

    container.addEventListener(event, clickHandler, true);
    container.addEventListener(event, clickHandler, true);
    container.addEventListener(event, clickHandler, false);
    $container.bind('click', clickHandler);
    $container.bind('click', clickHandler);
    $container.on('click', clickHandler);
    $container.on('click', clickHandler);

    dispatchEvent(container, event);
    strictEqual(clickHandlerCounter, 6);

    container.removeEventListener(event, clickHandler, true);
    container.removeEventListener(event, clickHandler, false);
    $container.unbind('click', clickHandler);
    $container.off('click', clickHandler);
});

if (browserUtils.isIE && browserUtils.version >= 10) {
    test('only one of several handlers must be called (MSPointerDown, pointerdown combination) (T233158)', function () {
        var events              = browserUtils.isMSEdge ? 'pointerdown MSPointerDown' : 'pointerdown';
        var eventHandlerCounter = 0;

        var handler = function () {
            eventHandlerCounter++;
        };

        listeners.initElementListening(document, [events]);

        listeners.addInternalEventListener(document, [events], function () {
        });

        document.addEventListener('pointerdown', handler, true);
        document.addEventListener('pointerdown', handler, true);
        dispatchPointerEvent(container, browserUtils.version > 10 ? 'pointerdown' : 'MSPointerDown');
        strictEqual(eventHandlerCounter, browserUtils.version > 10 ? 1 : 0);

        document.addEventListener('pointerdown', handler, true);
        document.addEventListener('pointerdown', handler, false);
        dispatchPointerEvent(container, browserUtils.version > 10 ? 'pointerdown' : 'MSPointerDown');
        strictEqual(eventHandlerCounter, browserUtils.version > 10 ? 3 : 0);
        document.removeEventListener('pointerdown', handler, true);
        document.removeEventListener('pointerdown', handler, false);

        var $document = $(document);

        $document.bind('pointerdown', handler);
        $document.bind('pointerdown', handler);
        dispatchPointerEvent(container, browserUtils.version > 10 ? 'pointerdown' : 'MSPointerDown');
        strictEqual(eventHandlerCounter, browserUtils.version > 10 ? 5 : 0);
        $document.unbind('pointerdown', handler);

        $document.on('pointerdown', handler);
        $document.on('pointerdown', handler);
        dispatchPointerEvent(container, browserUtils.version > 10 ? 'pointerdown' : 'MSPointerDown');
        strictEqual(eventHandlerCounter, browserUtils.version > 10 ? 7 : 0);
        $document.off('pointerdown', handler);

        if (browserUtils.version < 12) {
            document.addEventListener('pointerdown', handler, true);
            document.addEventListener('MSPointerDown', handler, true);
            dispatchPointerEvent(container, browserUtils.isIE11 ? 'pointerdown' : 'MSPointerDown');
            strictEqual(eventHandlerCounter, browserUtils.isIE11 ? 8 : 1);

            document.removeEventListener('pointerdown', handler, true);
            document.addEventListener('MSPointerDown', handler, true);
            dispatchPointerEvent(container, browserUtils.isIE11 ? 'pointerdown' : 'MSPointerDown');
            strictEqual(eventHandlerCounter, browserUtils.isIE11 ? 9 : 2);

            document.removeEventListener('MSPointerDown', handler, true);
            document.addEventListener('MSPointerDown', handler, true);
            document.addEventListener('MSPointerDown', handler, false);
            dispatchPointerEvent(container, browserUtils.isIE11 ? 'pointerdown' : 'MSPointerDown');
            strictEqual(eventHandlerCounter, browserUtils.isIE11 ? 11 : 4);
            document.removeEventListener('MSPointerDown', handler, true);
            document.removeEventListener('MSPointerDown', handler, false);

            document.addEventListener('pointerdown', handler, true);
            document.addEventListener('MSPointerDown', handler, false);
            dispatchPointerEvent(container, browserUtils.isIE11 ? 'pointerdown' : 'MSPointerDown');
            strictEqual(eventHandlerCounter, browserUtils.isIE11 ? 13 : 5);
            document.removeEventListener('pointerdown', handler, true);
            document.removeEventListener('MSPointerDown', handler, false);

            $document.bind('pointerdown', handler);
            $document.bind('MSPointerDown', handler);
            dispatchPointerEvent(container, browserUtils.isIE11 ? 'pointerdown' : 'MSPointerDown');
            strictEqual(eventHandlerCounter, browserUtils.isIE11 ? 14 : 6);
            $document.unbind('pointerdown', handler);
            $document.unbind('MSPointerDown', handler);

            $document.bind('MSPointerDown', handler);
            $document.bind('MSPointerDown', handler);
            dispatchPointerEvent(container, browserUtils.isIE11 ? 'pointerdown' : 'MSPointerDown');
            strictEqual(eventHandlerCounter, browserUtils.isIE11 ? 14 : 8);
            $document.unbind('MSPointerDown', handler);

            $document.on('pointerdown', handler);
            $document.on('MSPointerDown', handler);
            dispatchPointerEvent(container, browserUtils.isIE11 ? 'pointerdown' : 'MSPointerDown');
            strictEqual(eventHandlerCounter, browserUtils.isIE11 ? 15 : 9);
            $document.off('pointerdown', handler);
            $document.off('MSPointerDown', handler);

            $document.on('MSPointerDown', handler);
            $document.on('MSPointerDown', handler);
            dispatchPointerEvent(container, browserUtils.isIE11 ? 'pointerdown' : 'MSPointerDown');
            strictEqual(eventHandlerCounter, browserUtils.isIE11 ? 15 : 11);
            $document.off('MSPointerDown', handler);
        }
    });
}

module('dispatched event flag should be written in the proper window (GH-529)');

asyncTest('dispatchEvent, fireEvent, click', function () {
    var iframe = document.createElement('iframe');
    var link   = document.createElement('a');
    // NOTE: To prevent the export of the constant and modification of the Listeners module export,
    // we declare the constant in the test again.
    var dispatchedEventFlag = 'hammerhead|event-sandbox-dispatch-event-flag';
    // NOTE: After adding an element to a document which differs from the document where the element was created,
    // some browsers automatically replace the element prototype's methods
    // with methods of the element prototype from the different window.
    var getListenersModule = function (iframeListenersModule, topLevelListenersModule) {
        return browserUtils.isWebKit || browserUtils.isMSEdge ? topLevelListenersModule : iframeListenersModule;
    };

    iframe.id = 'test_unique_id_qrsdcz';

    window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            var iframeDocument            = iframe.contentDocument;
            var iframeHammerhead          = iframe.contentWindow['%hammerhead%'];
            var iframeListeners           = iframeHammerhead.get('./sandbox/event/listeners');
            var targetListeners           = getListenersModule(iframeListeners, Listeners);
            var storedBeforeDispatchEvent = targetListeners.beforeDispatchEvent;
            var storedAfterDispatchEvent  = targetListeners.afterDispatchEvent;

            targetListeners.beforeDispatchEvent = function (el) {
                ok(!iframe.contentWindow[dispatchedEventFlag]);
                ok(!window[dispatchedEventFlag]);

                storedBeforeDispatchEvent(el);

                ok(iframe.contentWindow[dispatchedEventFlag]);
                ok(!window[dispatchedEventFlag]);
            };

            targetListeners.afterDispatchEvent  = function (el) {
                ok(iframe.contentWindow[dispatchedEventFlag]);
                ok(!window[dispatchedEventFlag]);

                storedAfterDispatchEvent(el);

                ok(!iframe.contentWindow[dispatchedEventFlag]);
                ok(!window[dispatchedEventFlag]);
            };

            iframeDocument.body.appendChild(link);

            dispatchEvent(link, 'click');
            link.click();

            if (document.fireEvent)
                link.fireEvent('click');

            iframe.parentNode.removeChild(iframe);
            start();
        });

    document.body.appendChild(iframe);
});

if (browserUtils.isIE && !browserUtils.isMSEdge) {
    asyncTest('setSelection', function () {
        var iframe    = document.createElement('iframe');
        var testInput = document.createElement('input');
        // NOTE: To prevent the export of the constant and modification of the Listeners module export,
        // we declare the constant in the test again.
        var dispatchedEventFlag = 'hammerhead|event-sandbox-dispatch-event-flag';
        var counter             = 0;

        testInput.addEventListener('focus', function () {
            iframe.parentNode.removeChild(iframe);
            start();
        });

        testInput.value = 'test';
        iframe.id       = 'test_unique_id_qrsj12vbz';

        window.QUnitGlobals.waitForIframe(iframe)
            .then(function () {
                var iframeDocument            = iframe.contentDocument;
                var iframeHammerhead          = iframe.contentWindow['%hammerhead%'];
                var iframeListeners           = iframeHammerhead.get('./sandbox/event/listeners');
                var storedBeforeDispatchEvent = iframeListeners.beforeDispatchEvent;
                var storedAfterDispatchEvent  = iframeListeners.afterDispatchEvent;

                iframeListeners.beforeDispatchEvent = function (el) {
                    strictEqual(!!counter, !!iframe.contentWindow[dispatchedEventFlag]);
                    ok(!window[dispatchedEventFlag]);

                    storedBeforeDispatchEvent(el);

                    ok(iframe.contentWindow[dispatchedEventFlag]);
                    ok(!window[dispatchedEventFlag]);

                    counter++;
                };

                iframeListeners.afterDispatchEvent = function (el) {
                    ok(iframe.contentWindow[dispatchedEventFlag]);
                    ok(!window[dispatchedEventFlag]);

                    storedAfterDispatchEvent(el);

                    if (counter === 2)
                        ok(iframe.contentWindow[dispatchedEventFlag]);
                    else
                        ok(!iframe.contentWindow[dispatchedEventFlag]);

                    ok(!window[dispatchedEventFlag]);

                    counter++;
                };

                iframeDocument.body.appendChild(testInput);
                testInput.setSelectionRange(1, 2);
            });

        document.body.appendChild(iframe);
    });
}

