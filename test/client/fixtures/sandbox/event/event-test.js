var browserUtils   = hammerhead.utils.browser;
var nativeMethods  = hammerhead.nativeMethods;
var iframeSandbox  = hammerhead.sandbox.iframe;
var eventSandbox   = hammerhead.sandbox.event;
var listeners      = hammerhead.sandbox.event.listeners;
var focusBlur      = hammerhead.sandbox.event.focusBlur;
var eventSimulator = hammerhead.sandbox.event.eventSimulator;

QUnit.testStart(function () {
    iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);
});

if (!browserUtils.isIE9) {
    asyncTest('override setTimeout error (T203986)', function () {
        var str = 'success';

        setTimeout(function (msg) {
            strictEqual(msg, str);
            start();
        }, 10, str);
    });
}

module('regression');

if (document.attachEvent) {
    test('document.attachEvent must be overriden (Q532574)', function () {
        var $div                = $('<div>').appendTo('body');
        var clickRaisedCount    = 0;
        var docClickRaisedCount = 0;

        $div[0].attachEvent('onmousedown', function () {
            clickRaisedCount++;
        });

        document.attachEvent('onmousedown', function () {
            docClickRaisedCount++;
        });

        eventSimulator.mousedown($div[0]);

        strictEqual(clickRaisedCount, 1);
        strictEqual(docClickRaisedCount, 1);

        $div.remove();
    });
}

asyncTest('focus / blur events in iframe (B253685)', function () {
    var iframe = document.createElement('iframe');

    iframe.id = 'test1';
    window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
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
                iframe.parentNode.removeChild(iframe);
                start();
            });
        });
    document.body.appendChild(iframe);
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

    if (div.attachEvent) {
        div.attachEvent('onclick', function () {
            attachedHandlerCount++;
        });
    }

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
    strictEqual(attachedHandlerCount, browserUtils.isIE && browserUtils.version < 11 ? 1 : 0);
    strictEqual(addedHandlerCount, 1);
    strictEqual(inlineHandlerClickedCount, 1);
    strictEqual(jQueryHandlerClickedCount, 1);

    if (div.fireEvent) {
        div.fireEvent('onclick', event);
        strictEqual(attachedHandlerCount, 2);
        strictEqual(addedHandlerCount, 2);
        strictEqual(inlineHandlerClickedCount, 2);
        strictEqual(jQueryHandlerClickedCount, 2);
    }

    // NOTE: createEventObject (we CANNOT call dispatchEvent, only fire the event).
    if (document.createEventObject) {
        event = document.createEventObject('MouseEvents');
        div.fireEvent('onclick', event);

        strictEqual(attachedHandlerCount, 3);
        strictEqual(addedHandlerCount, 3);
        strictEqual(inlineHandlerClickedCount, 3);
        strictEqual(jQueryHandlerClickedCount, 3);
    }

    // NOTE: new MouseEvent (not for IE with its fireEvent).
    var error = false;

    if (!browserUtils.isIE) {
        try {
            event = new MouseEvent('click', {
                'view':       window,
                'bubbles':    true,
                'cancelable': true
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
    }
    $div.remove();
});

test('attachEvent, fireEvent, detachEvent must be overriden (T239606)', function () {
    var el = nativeMethods.createElement.call(document, 'A');

    var attachEventExist = !!el.attachEvent;
    var fireEventExist   = !!el.fireEvent;
    var detachEventExist = !!el.detachEvent;

    if (attachEventExist || fireEventExist || detachEventExist)
        ok(nativeMethods.attachEvent && nativeMethods.fireEvent && nativeMethods.detachEvent);
    else {
        eventSandbox.processElement(el);

        ok(!el.attachEvent);
        ok(!el.fireEvent);
        ok(!el.detachEvent);
    }
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
        }
    };

    var eventObjWrap = {
        clickCount:  0,
        handleEvent: function () {
            this.clickCount++;

            test();
        }
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
    var svg             = document.createElement('svg');
    var handlerIsCalled = false;

    document.body.appendChild(svg);

    svg.addEventListener('click', function () {
        handlerIsCalled = true;
    });

    listeners.initElementListening(svg, ['click']);
    listeners.addFirstInternalHandler(svg, ['click'], function (event, isDispatchedEventFlag) {
        ok(isDispatchedEventFlag);
    });

    var event = document.createEvent('MouseEvents');

    event.initEvent('click', true, false);
    svg.dispatchEvent(event);

    ok(handlerIsCalled);

    svg.parentNode.removeChild(svg);
});
