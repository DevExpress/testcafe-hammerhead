var browserUtils     = hammerhead.utils.browser;
var featureDetection = hammerhead.utils.featureDetection;
var eventUtils       = hammerhead.utils.event;
var nativeMethods    = hammerhead.nativeMethods;
var listeners        = hammerhead.sandbox.event.listeners;
var focusBlur        = hammerhead.sandbox.event.focusBlur;
var eventSimulator   = hammerhead.sandbox.event.eventSimulator;
var listeningCtx     = hammerhead.sandboxUtils.listeningContext;

asyncTest('override setTimeout error (T203986)', function () {
    var str = 'success';

    setTimeout(function (msg) {
        strictEqual(msg, str);
        start();
    }, 10, str);
});

test('remove event listener in the context of optional parameters ("options" object or "useCapture") (GH-1737)', function () {
    expect(4);

    function expectedClickHandler () {
        ok(true);
    }

    function unexpectedClickHandler () {
        ok(false);
    }

    var testCases = [
        { addEventListener: [unexpectedClickHandler], removeEventListener: [unexpectedClickHandler] },
        { addEventListener: [unexpectedClickHandler, true], removeEventListener: [unexpectedClickHandler, true] },
        { addEventListener: [unexpectedClickHandler], removeEventListener: [unexpectedClickHandler, false] },
        { addEventListener: [unexpectedClickHandler, false], removeEventListener: [unexpectedClickHandler] },
        { addEventListener: [unexpectedClickHandler, { capture: false }], removeEventListener: [unexpectedClickHandler, { capture: false }] },
    ];

    testCases = testCases.concat([
        { addEventListener: [unexpectedClickHandler, { capture: false }], removeEventListener: [unexpectedClickHandler] },
        { addEventListener: [unexpectedClickHandler], removeEventListener: [unexpectedClickHandler, { capture: false }] },
        { addEventListener: [expectedClickHandler, { capture: true }], removeEventListener: [expectedClickHandler, false] },
        { addEventListener: [expectedClickHandler, false], removeEventListener: [expectedClickHandler, { capture: true }] },
    ]);

    function checkEventListenerRemoving (el) {
        testCases.forEach(function (testCase) {
            var addEventListenerArgs    = ['click'].concat(testCase.addEventListener);
            var removeEventListenerArgs = ['click'].concat(testCase.removeEventListener);

            el.addEventListener.apply(el, addEventListenerArgs);
            el.removeEventListener.apply(el, removeEventListenerArgs);

            el.click();

            if (testCase.addEventListener[0] === expectedClickHandler)
                el.removeEventListener.apply(el, addEventListenerArgs);
        });
    }

    var divEl = document.body.appendChild(document.createElement('div'));

    listeners.initElementListening(document, ['click']);
    listeners.initElementListening(divEl, ['click']);

    checkEventListenerRemoving(document.body);
    checkEventListenerRemoving(divEl);
});

test('wrappers of native functions should return the correct string representations', function () {
    window.checkStringRepresentation(window.HTMLInputElement.prototype.setSelectionRange,
        nativeMethods.setSelectionRange,
        'HTMLInputElement.prototype.setSelectionRange');
    window.checkStringRepresentation(window.HTMLTextAreaElement.prototype.setSelectionRange,
        nativeMethods.textAreaSetSelectionRange,
        'HTMLTextAreaElement.prototype.setSelectionRange');

    if (window.EventTarget) {
        window.checkStringRepresentation(window.EventTarget.prototype.dispatchEvent, nativeMethods.dispatchEvent,
            'EventTarget.prototype.dispatchEvent');
    }
    else {
        window.checkStringRepresentation(window.Window.prototype.dispatchEvent, nativeMethods.dispatchEvent,
            'Window.prototype.dispatchEvent');
        window.checkStringRepresentation(window.Document.prototype.dispatchEvent, nativeMethods.dispatchEvent,
            'Document.prototype.dispatchEvent');
        window.checkStringRepresentation(window.HTMLElement.prototype.dispatchEvent, nativeMethods.dispatchEvent,
            'HTMLElement.prototype.dispatchEvent');
        window.checkStringRepresentation(window.SVGElement.prototype.dispatchEvent, nativeMethods.dispatchEvent,
            'SVGElement.prototype.dispatchEvent');
    }

    window.checkStringRepresentation(window.HTMLElement.prototype.focus, nativeMethods.focus,
        'HTMLElement.prototype.focus');
    window.checkStringRepresentation(window.HTMLElement.prototype.blur, nativeMethods.blur,
        'HTMLElement.prototype.blur');
    window.checkStringRepresentation(window.HTMLElement.prototype.click, nativeMethods.click,
        'HTMLElement.prototype.click');
    window.checkStringRepresentation(window.Window.focus, nativeMethods.focus, 'Window.focus');
    window.checkStringRepresentation(window.Window.blur, nativeMethods.blur, 'Window.blur');
    window.checkStringRepresentation(window.Event.prototype.preventDefault, nativeMethods.preventDefault,
        'Event.prototype.preventDefault');

    if (window.TextRange && window.TextRange.prototype.select) {
        window.checkStringRepresentation(window.TextRange.prototype.select, nativeMethods.select,
            'TextRange.prototype.select');
    }
});

module('regression');

asyncTest('focus / blur events in iframe (B253685)', function () {
    return createTestIframe()
        .then(function (iframe) {
            var iframeDocument         = iframe.contentWindow.document;
            var iframeBody             = iframeDocument.body;
            var blurOnIframeBodyRaised = false;

            strictEqual(iframeDocument.activeElement, iframeBody);

            iframeBody.addEventListener('blur', function () {
                blurOnIframeBodyRaised = true;
            });

            iframe.focus();

            focusBlur.focus(iframe, function () {
                ok(!blurOnIframeBodyRaised, 'a blur event on the input must not be raised');

                start();
            });
        });
});

test('document.addEventListener (Q532574)', function () {
    var docClickRaisedCount = 0;

    document.addEventListener('mousedown', function () {
        docClickRaisedCount++;
    });

    eventSimulator.mousedown(document);

    strictEqual(docClickRaisedCount, 1);
});

test('firing and dispatching the events created in different ways (Q532574)', function () {
    var $div                      = $('<div>').appendTo('body');
    var div                       = $div[0];
    var attachedHandlerCount      = 0;
    var addedHandlerCount         = 0;
    var inlineHandlerClickedCount = 0;
    var jQueryHandlerClickedCount = 0;
    var event                     = null;

    div.addEventListener('click', function () {
        addedHandlerCount++;
    });

    div.onclick = function () {
        inlineHandlerClickedCount++;
    };

    $div.click(function () {
        jQueryHandlerClickedCount++;
    });

    // NOTE: createEvent.
    event = document.createEvent('MouseEvents');
    event.initEvent('click', true, false);

    div.dispatchEvent(event);
    strictEqual(addedHandlerCount, 1);
    strictEqual(inlineHandlerClickedCount, 1);
    strictEqual(jQueryHandlerClickedCount, 1);

    var error = false;

    try {
        event = new MouseEvent('click', {
            'view':       window,
            'bubbles':    true,
            'cancelable': true,
        });
    }
    catch (e) {
        // NOTE: The browser doesn't support this action.
        error = true;
    }

    if (!error) {
        div.dispatchEvent(event);
        strictEqual(attachedHandlerCount, 0);
        strictEqual(addedHandlerCount, 2);
        strictEqual(inlineHandlerClickedCount, 2);
        strictEqual(jQueryHandlerClickedCount, 2);
    }

    $div.remove();
});

asyncTest('calling function from handler parameter for window.onmessage event (T137892)', function () {
    window.addEventListener('message', function (e) {
        try {
            e.stopPropagation();
            ok(true);
        }
        catch (error) {
            ok(false);
        }
        finally {
            start();
        }
    });

    eval(processScript('window.postMessage("hello", "*")'));
});

asyncTest('handler not the function for addEventListener (T261234)', function () {
    var divEl = document.body.appendChild(document.createElement('div'));

    var eventObjOrigin = {
        clickCount:  0,
        handleEvent: function () {
            this.clickCount++;
        },
    };

    var eventObjWrap = {
        clickCount:  0,
        handleEvent: function () {
            this.clickCount++;

            test();
        },
    };

    function test () {
        strictEqual(eventObjOrigin.clickCount, 1);
        strictEqual(eventObjWrap.clickCount, 1);

        document.body.removeChild(divEl);
        start();
    }

    listeners.initElementListening(divEl);

    nativeMethods.addEventListener.call(divEl, 'click', eventObjOrigin);
    divEl.addEventListener('click', eventObjWrap);
    divEl.click();
});

if (browserUtils.isWebKit) {
    asyncTest('the "Illegal invocation" error after svg element focused (#82)', function () {
        var $svgElement = $(
            '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1">' +
            '<rect id="rect" width="300" height="300" fill="red" tabIndex="1"></rect>' +
            '</svg>').appendTo('body');

        processDomMeth($svgElement[0]);

        var rectElement = document.getElementById('rect');

        rectElement.onfocus = function () {
            rectElement.onblur = function () {
                ok(true);
                $svgElement.remove();
                start();
            };
            rectElement.blur();
        };
        rectElement.focus();
    });
}

test('the click event handler for the svg element must be overridden correctly (B238956)', function () {
    var $svg       = $('<svg xmlns="http://www.w3.org/2000/svg" version="1.1"></svg>');
    var clickCount = 0;

    $svg
        .width(500)
        .height(300)
        .appendTo('body')
        .click(function () {
            clickCount++;
        });

    eventSimulator.click($svg[0]);

    strictEqual(clickCount, 1);

    $svg.remove();
});

test('SVGElement.dispatchEvent should be overriden (GH-614)', function () {
    var svg             = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    var handlerIsCalled = false;

    document.body.appendChild(svg);

    svg.addEventListener('click', function () {
        handlerIsCalled = true;
    });

    listeners.initElementListening(svg, ['click']);
    listeners.addFirstInternalEventBeforeListener(svg, ['click'], function (event, isDispatchedEventFlag) {
        ok(isDispatchedEventFlag);
    });

    var event = document.createEvent('MouseEvents');

    event.initEvent('click', true, false);
    svg.dispatchEvent(event);

    ok(handlerIsCalled);

    svg.parentNode.removeChild(svg);
});

test('should not wrap invalid event handlers (GH-1251)', function () {
    var handlers        = [void 0, 1, null, 'str', {}];
    var invalidHandlers = [];
    var errorText       = null;

    if ('Symbol' in window)
        handlers.push(Symbol('foo'));

    // NOTE: on adding some type of handlers an "Invalid argument" error can be raised
    for (var i = handlers.length - 1; i > -1; i--) {
        var nativeAddEventListener = nativeMethods.windowAddEventListener || nativeMethods.addEventListener;

        try {
            nativeAddEventListener.call(window, 'click', handlers[i]);
        }
        catch (e) {
            if (!errorText)
                errorText = e.toString();

            invalidHandlers.push(handlers[i]);
        }
    }

    var testHandlers = function (target) {
        var storedHandlerWrappersCount = listeningCtx.getEventCtx(target, 'click').wrappers.length;

        handlers.forEach(function (handler) {
            try {
                target.addEventListener('click', handler);
            }
            catch (e) {
                ok(invalidHandlers.indexOf(handler) !== -1 && e.toString() === errorText);
            }
        });

        strictEqual(listeningCtx.getEventCtx(target, 'click').wrappers.length, storedHandlerWrappersCount);

        // NOTE: we need to remove global event handlers before next test starts
        // we need try/catch statement because we have incorrect handler object
        handlers.forEach(function (handler) {
            var nativeRemoveEventListener = nativeMethods.windowRemoveEventListener || nativeMethods.removeEventListener;

            try {
                nativeRemoveEventListener.call(target, 'click', handler);
            }
            catch (e) {
                //
            }
        });
    };

    testHandlers(window);
    testHandlers(document);
    testHandlers(document.body);
});

test('event.preventDefault call should change the event.defaultPrevented property value (GH-1588)', function () {
    var input = document.createElement('input');

    document.body.appendChild(input);

    input.addEventListener('keydown', function (e) {
        e.preventDefault();

        ok(e.defaultPrevented);

        input.parentNode.removeChild(input);
    });

    eventSimulator.keydown(input);
});

asyncTest('mouse events in iframe', function () {
    let simulatorMethods = [];
    let allEvents        = [];

    if (featureDetection.isTouchDevice) {
        simulatorMethods = [
            'touchstart',
            'touchend',
            'touchmove',
            'mousedown',
            'mouseup',
            'mousemove',
            'mouseover',
            'mouseenter',
            'click',
            'dblclick',
            'contextmenu',
        ];

        allEvents = [
            'pointerdown',
            'touchstart',
            'pointerup',
            'touchend',
            'pointermove',
            'touchmove',
            'mousedown',
            'mouseup',
            'mousemove',
            'pointerover',
            'mouseover',
            'pointerenter',
            'mouseenter',
            'click',
            'dblclick',
            'contextmenu',
        ];
    }
    else {
        simulatorMethods = [
            'mousedown',
            'mouseup',
            'mousemove',
            'mouseover',
            'mouseenter',
            'click',
            'dblclick',
            'contextmenu',
        ];

        allEvents = [
            'pointerdown',
            'mousedown',
            'pointerup',
            'mouseup',
            'pointermove',
            'mousemove',
            'pointerover',
            'mouseover',
            'pointerenter',
            'mouseenter',
            'click',
            'dblclick',
            'contextmenu',
        ];
    }

    return createTestIframe()
        .then(function (iframe) {
            iframe.style.width           = '300px';
            iframe.style.height          = '100px';
            iframe.style.border          = '5px solid black';
            iframe.style.padding         = '20px';
            iframe.style.backgroundColor = 'yellow';

            var div = document.createElement('div');

            div.style.display = 'inline-block';

            div.appendChild(iframe);
            document.body.appendChild(div);

            var actualEvents = [];

            var eventsInsideFrame = ['pointerover', 'mouseover', 'pointerenter', 'mouseenter'];

            if (!eventUtils.hasPointerEvents) {
                const pointerRegExp = /pointer(down|up|move|over|enter)/;

                allEvents = allEvents.filter(function (eventName) {
                    return !pointerRegExp.test(eventName);
                });

                eventsInsideFrame = eventsInsideFrame.filter(function (eventName) {
                    return !pointerRegExp.test(eventName);
                });
            }

            var getHandler = function (i) {
                return function () {
                    actualEvents.push(allEvents[i]);
                };
            };

            for (var i = 0; i < allEvents.length; i++)
                iframe.addEventListener(allEvents[i], getHandler(i));

            for (i = 0; i < simulatorMethods.length; i++)
                eventSimulator[simulatorMethods[i]](iframe, { clientX: 190, clientY: 130 });

            deepEqual(actualEvents, eventsInsideFrame);

            actualEvents = [];

            for (i = 0; i < simulatorMethods.length; i++)
                eventSimulator[simulatorMethods[i]](iframe, { clientX: 190, clientY: 70 });

            deepEqual(actualEvents, allEvents);

            document.body.removeChild(div);

            start();
        });
});

asyncTest('hover style in iframe', function () {
    return createTestIframe()
        .then(function (iframe) {
            var style = document.createElement('style');
            var div   = document.createElement('div');

            div.style.display = 'inline-block';
            style.innerHTML   = 'iframe: hover { background-color: blue!important; }';

            document.body.appendChild(style);
            document.body.appendChild(div);

            iframe.style.width = '300px';
            iframe.style.height = '100px';
            iframe.style.border = '5px solid black';
            iframe.style.padding = '20px';
            iframe.style.backgroundColor = 'yellow';

            div.appendChild(iframe);

            var initialBackgroundColor = window.getComputedStyle(iframe).backgroundColor;

            eventSimulator.mouseover(iframe, { clientX: 190, clientY: 130 });

            notEqual(window.getComputedStyle(iframe).backgroundColor, initialBackgroundColor);

            eventSimulator.mouseover(div, { clientX: 0, clientY: 0 });
            equal(window.getComputedStyle(iframe).backgroundColor, initialBackgroundColor);

            eventSimulator.mouseover(iframe, { clientX: 190, clientY: 70 });
            notEqual(window.getComputedStyle(iframe).backgroundColor, initialBackgroundColor);

            document.body.removeChild(div);
            document.body.removeChild(style);

            start();
        });
});

asyncTest('events should not be called twice (GH-2062)', function () {
    var eventCallCounter    = 0;
    var internalCallCounter = 0;

    listeners.initElementListening(window, ['keypress']);

    window.addEventListener('keypress', function () {
        ++eventCallCounter;
    });

    listeners.addInternalEventBeforeListener(window, ['keypress'], function () {
        ++internalCallCounter;
    });

    var eventObj = document.createEvent('KeyboardEvent');

    eventObj.initKeyboardEvent('keypress', true, true, window, 0, 0, 0, 0, 0, '1');

    window.dispatchEvent(eventObj);

    setTimeout(function () {
        strictEqual(eventCallCounter, 1);
        strictEqual(internalCallCounter, 1);
        start();
    }, 1000);
});

test('events should be restored after iframe rewriting (GH-1881)', function () {
    var internalClickEventCounter = 0;
    var contentWindow;
    var contentDocument;

    return createTestIframe()
        .then(function (iframe) {
            contentWindow = iframe.contentWindow;
            contentDocument = iframe.contentDocument;

            contentDocument.open();
            contentDocument.write('<!doctype html><html><head></head><body>hello</body></html>');
            contentDocument.close();

            contentWindow['%hammerhead%'].eventSandbox.listeners.addInternalEventBeforeListener(contentWindow, ['click'], function () {
                ++internalClickEventCounter;
            });

            eventSimulator.click(contentDocument.body);

            return window.wait(500);
        })
        .then(function () {
            strictEqual(internalClickEventCounter, 1);

            internalClickEventCounter = 0;

            contentDocument.open();
            contentDocument.write('<!doctype html><html><head></head><body>world</body></html>');
            contentDocument.close();

            eventSimulator.click(contentDocument.body);

            return window.wait(500);
        })
        .then(function () {
            strictEqual(internalClickEventCounter, 1);
        });
});
