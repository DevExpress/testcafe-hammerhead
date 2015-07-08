var Browser   = Hammerhead.get('./util/browser');
var DOM       = Hammerhead.get('./util/dom');
var Listeners = Hammerhead.get('./sandboxes/event/listeners');

Hammerhead.init(window, document);

$(document).ready(function () {
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
        var pointEvent = Browser.isIE11 ? document.createEvent('PointerEvent') : document.createEvent('MSPointerEvent');

        pointEvent.initPointerEvent(type, true, true, window, 0, 0,
            0, 0, 0, false, false, false, false, 0, null, 0, 0, 0, 0, 0.5, 0, 0, 0, 1, 'mouse', Date.now(), true);

        el.dispatchEvent(pointEvent);
    };

    QUnit.testStart = function () {
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
    };

    QUnit.testDone = function () {
        $container.remove();
        $input.remove();
        $uiElement.remove();
    };

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

        Listeners.initElementListening(container, [event]);

        Listeners.addInternalEventListener(container, [event], function () {
        });

        function checkHandlerCounters (first, second, third, fourth) {
            strictEqual(firstHandlerCounter, first);
            strictEqual(secondHandlerCounter, second);
            strictEqual(thirdHandlerCounter, third);
            strictEqual(fourthHandlerCounter, fourth);
        }

        //NOTE: because of T233158 - Wrong test run for mouse click in IE
        //it should be different handlers
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

        var stopPropagation = function (e, dispatched, preventEvent, cancelHandlers, stopPropagation) {
            strictEqual(e.type, event);
            stopPropagation();
        };

        Listeners.initElementListening(container, [event]);
        Listeners.addInternalEventListener(container, [event], stopPropagation);
        bindAll(event);

        notEqual(DOM.getActiveElement(), input);
        input.focus();

        ok(!containerCaptureEventRaised);
        ok(!containerBubbleEventRaised);
        ok(!elementCaptureEventRaised);
        ok(!elementBubbleEventRaised);

        strictEqual(DOM.getActiveElement(), input);
    });

    test('add wrapper', function () {
        var event = 'click';

        var onclick1 = function () {
            strictEqual(this, input);
        };

        var clickListenersWrapper = function (e, originListener) {
            originListener.call(input, e);
        };

        Listeners.setEventListenerWrapper(container, [event], clickListenersWrapper);
        container.addEventListener(event, onclick1, true);

        expect(1);

        dispatchEvent(container, event);
    });

    module('prevent event');

    test('preventer added before listener', function () {
        var event              = 'click';
        var preventEventRaised = false;

        var preventEvent = function (e, dispatched, preventEvent) {
            strictEqual(e.type, event);
            preventEventRaised = true;
            preventEvent();
        };

        Listeners.initElementListening(container, [event]);
        Listeners.addInternalEventListener(container, [event], preventEvent);
        bindAll(event);
        dispatchEvent(input, event);

        ok(preventEventRaised);
        ok(!containerCaptureEventRaised);
        ok(!containerBubbleEventRaised);
        ok(!elementCaptureEventRaised);
        ok(!elementBubbleEventRaised);

        preventEventRaised = false;
        Listeners.removeInternalEventListener(container, [event], preventEvent);
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

        var preventEvent = function (e, dispatched, preventEvent) {
            strictEqual(e.type, event);
            preventEventRaised = true;
            preventEvent();
        };

        Listeners.initElementListening(container, [event]);
        bindAll(event);
        Listeners.addInternalEventListener(container, [event], preventEvent);
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

        var preventEvent = function (e, dispatched, preventEvent) {
            preventEventCounter++;
            preventEvent();
        };

        Listeners.initElementListening(container, [event1, event2]);
        Listeners.addInternalEventListener(container, [event1], handler1);
        Listeners.addInternalEventListener(container, [event1], preventEvent);
        Listeners.addInternalEventListener(container, [event1], handler2);
        Listeners.addInternalEventListener(container, [event2], preventEvent);

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

    test('canceller added betfore listener', function () {
        var event                = 'click';
        var cancelHandlersRaised = false;

        var cancelHandlers = function (e, dispatched, preventEvent, cancelHandlers) {
            strictEqual(e.type, event);
            cancelHandlersRaised = true;
            cancelHandlers();
        };

        Listeners.initElementListening(container, [event]);
        Listeners.addInternalEventListener(container, [event], cancelHandlers);
        bindAll(event);
        dispatchEvent(uiElement, event);

        ok(cancelHandlersRaised);
        ok(!containerCaptureEventRaised);
        ok(!containerBubbleEventRaised);
        ok(!elementCaptureEventRaised);
        ok(!elementBubbleEventRaised);
        ok(uiElementCaptureEventRaised);
        ok(uiElementBubbleEventRaised);

        Listeners.removeInternalEventListener(container, [event], cancelHandlers);
    });

    test('canceller added after listener', function () {
        var event                = 'click';
        var cancelHandlersRaised = false;

        var cancelHandlers = function (e, dispatched, preventEvent, cancelHandlers) {
            strictEqual(e.type, event);
            cancelHandlersRaised = true;
            cancelHandlers();
        };

        Listeners.initElementListening(container, [event]);
        bindAll(event);
        Listeners.addInternalEventListener(container, [event], cancelHandlers);
        dispatchEvent(uiElement, event);

        ok(cancelHandlersRaised);
        ok(!containerCaptureEventRaised);
        ok(!containerBubbleEventRaised);
        ok(!elementCaptureEventRaised);
        ok(!elementBubbleEventRaised);
        ok(uiElementCaptureEventRaised);
        ok(uiElementBubbleEventRaised);

        Listeners.removeInternalEventListener(container, [event], cancelHandlers);
    });

    //T233158 - Wrong test run for mouse click in IE
    test('special case for mourse click in IE(document handlers)', function () {
        var event               = 'click';
        var clickHandlerCounter = 0;

        var clickHandler = function () {
            clickHandlerCounter++;
        };

        Listeners.initElementListening(document, [event]);

        Listeners.addInternalEventListener(document, [event], function () {
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

    //T233158 - Wrong test run for mouse click in IE
    test('special case for mourse click in IE (body handlers)', function () {
        var event               = 'click';
        var clickHandlerCounter = 0;

        var clickHandler = function () {
            clickHandlerCounter++;
        };

        Listeners.initElementListening(document, [event]);

        Listeners.addInternalEventListener(document, [event], function () {
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

    //T233158 - Wrong test run for mouse click in IE
    test('special case for mourse click in IE (element handlers)', function () {
        var event               = 'click';
        var clickHandlerCounter = 0;

        var clickHandler = function () {
            clickHandlerCounter++;
        };

        Listeners.initElementListening(document, [event]);

        Listeners.addInternalEventListener(document, [event], function () {
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

    if (Browser.isIE && Browser.version >= 10) {
        //T233158 - Wrong test run for mouse click in IE (document pointer event handlers)
        test('MSPointerDown, pointerdown', function () {
            var events              = Browser.isMSEdge ? 'pointerdown MSPointerDown' : 'pointerdown';
            var eventHandlerCounter = 0;

            var handler = function () {
                eventHandlerCounter++;
            };

            Listeners.initElementListening(document, [events]);

            Listeners.addInternalEventListener(document, [events], function () {
            });

            document.addEventListener('pointerdown', handler, true);
            document.addEventListener('pointerdown', handler, true);
            dispatchPointerEvent(container, Browser.version > 10 ? 'pointerdown' : 'MSPointerDown');
            strictEqual(eventHandlerCounter, Browser.version > 10 ? 1 : 0);

            document.addEventListener('pointerdown', handler, true);
            document.addEventListener('pointerdown', handler, false);
            dispatchPointerEvent(container, Browser.version > 10 ? 'pointerdown' : 'MSPointerDown');
            strictEqual(eventHandlerCounter, Browser.version > 10 ? 3 : 0);
            document.removeEventListener('pointerdown', handler, true);
            document.removeEventListener('pointerdown', handler, false);

            var $document = $(document);

            $document.bind('pointerdown', handler);
            $document.bind('pointerdown', handler);
            dispatchPointerEvent(container, Browser.version > 10 ? 'pointerdown' : 'MSPointerDown');
            strictEqual(eventHandlerCounter, Browser.version > 10 ? 5 : 0);
            $document.unbind('pointerdown', handler);

            $document.on('pointerdown', handler);
            $document.on('pointerdown', handler);
            dispatchPointerEvent(container, Browser.version > 10 ? 'pointerdown' : 'MSPointerDown');
            strictEqual(eventHandlerCounter, Browser.version > 10 ? 7 : 0);
            $document.off('pointerdown', handler);

            if (Browser.version < 12) {
                document.addEventListener('pointerdown', handler, true);
                document.addEventListener('MSPointerDown', handler, true);
                dispatchPointerEvent(container, Browser.isIE11 ? 'pointerdown' : 'MSPointerDown');
                strictEqual(eventHandlerCounter, Browser.isIE11 ? 8 : 1);

                document.removeEventListener('pointerdown', handler, true);
                document.addEventListener('MSPointerDown', handler, true);
                dispatchPointerEvent(container, Browser.isIE11 ? 'pointerdown' : 'MSPointerDown');
                strictEqual(eventHandlerCounter, Browser.isIE11 ? 9 : 2);

                document.removeEventListener('MSPointerDown', handler, true);
                document.addEventListener('MSPointerDown', handler, true);
                document.addEventListener('MSPointerDown', handler, false);
                dispatchPointerEvent(container, Browser.isIE11 ? 'pointerdown' : 'MSPointerDown');
                strictEqual(eventHandlerCounter, Browser.isIE11 ? 11 : 4);
                document.removeEventListener('MSPointerDown', handler, true);
                document.removeEventListener('MSPointerDown', handler, false);

                document.addEventListener('pointerdown', handler, true);
                document.addEventListener('MSPointerDown', handler, false);
                dispatchPointerEvent(container, Browser.isIE11 ? 'pointerdown' : 'MSPointerDown');
                strictEqual(eventHandlerCounter, Browser.isIE11 ? 13 : 5);
                document.removeEventListener('pointerdown', handler, true);
                document.removeEventListener('MSPointerDown', handler, false);

                $document.bind('pointerdown', handler);
                $document.bind('MSPointerDown', handler);
                dispatchPointerEvent(container, Browser.isIE11 ? 'pointerdown' : 'MSPointerDown');
                strictEqual(eventHandlerCounter, Browser.isIE11 ? 14 : 6);
                $document.unbind('pointerdown', handler);
                $document.unbind('MSPointerDown', handler);

                $document.bind('MSPointerDown', handler);
                $document.bind('MSPointerDown', handler);
                dispatchPointerEvent(container, Browser.isIE11 ? 'pointerdown' : 'MSPointerDown');
                strictEqual(eventHandlerCounter, Browser.isIE11 ? 14 : 8);
                $document.unbind('MSPointerDown', handler);

                $document.on('pointerdown', handler);
                $document.on('MSPointerDown', handler);
                dispatchPointerEvent(container, Browser.isIE11 ? 'pointerdown' : 'MSPointerDown');
                strictEqual(eventHandlerCounter, Browser.isIE11 ? 15 : 9);
                $document.off('pointerdown', handler);
                $document.off('MSPointerDown', handler);

                $document.on('MSPointerDown', handler);
                $document.on('MSPointerDown', handler);
                dispatchPointerEvent(container, Browser.isIE11 ? 'pointerdown' : 'MSPointerDown');
                strictEqual(eventHandlerCounter, Browser.isIE11 ? 15 : 11);
                $document.off('MSPointerDown', handler);
            }
        });
    }
});
