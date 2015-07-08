var Browser        = Hammerhead.get('./util/browser');
var EventSandbox   = Hammerhead.get('./sandboxes/event/event');
var EventSimulator = Hammerhead.get('./sandboxes/event/simulator');
var FocusBlur      = Hammerhead.get('./sandboxes/event/focus-blur');
var IFrameSandbox  = Hammerhead.get('./sandboxes/iframe');
var Listeners      = Hammerhead.get('./sandboxes/event/listeners');
var NativeMethods  = Hammerhead.get('./sandboxes/native-methods');
var Const          = Hammerhead.get('../const');

QUnit.testStart = function () {
    IFrameSandbox.on(IFrameSandbox.IFRAME_READY_TO_INIT, initIFrameTestHandler);
    IFrameSandbox.off(IFrameSandbox.IFRAME_READY_TO_INIT, IFrameSandbox.iframeReadyToInitHandler);
};

QUnit.testDone = function () {
    IFrameSandbox.off(IFrameSandbox.IFRAME_READY_TO_INIT, initIFrameTestHandler);
};

var lastHovered = null;

function hoverElement (el) {
    if (lastHovered)
        dispatchMouseEvent(lastHovered, 'mouseout');
    dispatchMouseEvent(el, 'mouseover');
    lastHovered = el;
}

function dispatchMouseEvent (el, type) {
    var evt = null;
    var e   = {
        bubbles:       true,
        cancelable:    true,
        view:          window,
        detail:        0,
        ctrlKey:       false,
        altKey:        false,
        shiftKey:      false,
        metaKey:       false,
        button:        0,
        relatedTarget: void 0
    };

    if (document.createEvent) {
        evt = document.createEvent('MouseEvents');
        evt.initMouseEvent(type, e.bubbles, e.cancelable, e.view, e.detail, e.screenX, e.screenY,
            e.clientX, e.clientY, e.ctrlKey, e.altKey, e.shiftKey, e.metaKey, e.button, document.body.parentNode);
    }
    else if (document.createEventObject) {
        evt = document.createEventObject();
        for (var prop in e)
            evt[prop] = e[prop];
        evt.button = { 0: 1, 1: 4, 2: 2 }[evt.button] || evt.button;
    }

    if (el.dispatchEvent)
        NativeMethods.dispatchEvent.call(el, evt);
    else if (el.fireEvent)
        NativeMethods.fireEvent.call(el, 'on' + type, evt);

    lastHovered = el;
}

function isHovered (el) {
    return el.getAttribute(Const.HOVER_PSEUDO_CLASS_ATTR) === '';
}

if (!Browser.hasTouchEvents) {
    test('hover pseudo class', function () {
        var $parent = $('<div style="width:100px; height:100px; background-color: Red" class="parent">').appendTo($('body'));
        var $child  = $('<div style="width:50px; height:50px; background-color: Blue" class="child">').appendTo($parent);

        ok(!isHovered($parent[0]));
        ok(!isHovered($child[0]));

        hoverElement($parent[0]);
        ok(isHovered($parent[0]));
        ok(!isHovered($child[0]));

        hoverElement($child[0]);
        ok(isHovered($parent[0]));
        ok(isHovered($child[0]));

        hoverElement($('body')[0]);
        ok(!isHovered($parent[0]));
        ok(!isHovered($child[0]));

        $parent.remove();
        $child.remove();
    });
}

if (document.attachEvent) {
    //Q532574 - TestCafe cannot proceed a third-party drop-down menu in IE
    test('document.attachEvent', function () {
        var $div                = $('<div>').appendTo('body');
        var clickRaisedCount    = 0;
        var docClickRaisedCount = 0;

        $div[0].attachEvent('onmousedown', function () {
            clickRaisedCount++;
        });

        document.attachEvent('onmousedown', function () {
            docClickRaisedCount++;
        });

        EventSimulator.mousedown($div[0]);

        strictEqual(clickRaisedCount, 1);
        strictEqual(docClickRaisedCount, 1);

        $div.remove();
    });
}

//'B253685 - Google Disk - page is crashed when a text document is opening
asyncTest('focus blur in iframe', function () {
    var iframe = document.createElement('iframe');

    iframe.id = 'test1';
    document.body.appendChild(iframe);

    window.setTimeout(function () {
        var iframeDocument         = iframe.contentWindow.document;
        var iframeBody             = iframeDocument.body;
        var blurOnIframeBodyRaised = false;

        strictEqual(iframeDocument.activeElement, iframeBody);

        iframeBody.addEventListener('blur', function () {
            blurOnIframeBodyRaised = true;
        });

        iframe.focus();

        FocusBlur.focus(iframe, function () {
            ok(!blurOnIframeBodyRaised, 'a blur event on the input must not be raised');
            iframe.parentNode.removeChild(iframe);
            start();
        });
    }, 500);
});

//Q532574 - Check document addEventListener overriding
test('document.addEventListener', function () {
    var docClickRaisedCount = 0;

    document.addEventListener('mousedown', function () {
        docClickRaisedCount++;
    });

    EventSimulator.mousedown(document);

    strictEqual(docClickRaisedCount, 1);
});

//Q532574 - Fire and dispatch events from code, events created by different ways
test('combination of attachEvent and addEventListener', function () {
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

    //createEvent
    event = document.createEvent('MouseEvents');
    event.initEvent('click', true, false);

    div.dispatchEvent(event);
    strictEqual(attachedHandlerCount, Browser.isIE && Browser.version < 11 ? 1 : 0);
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

    //createEventObject (we CAN NOT call dispatchEvent, only fire event)
    if (document.createEventObject) {
        event = document.createEventObject('MouseEvents');
        div.fireEvent('onclick', event);

        strictEqual(attachedHandlerCount, 3);
        strictEqual(addedHandlerCount, 3);
        strictEqual(inlineHandlerClickedCount, 3);
        strictEqual(jQueryHandlerClickedCount, 3);
    }

    //new MouseEvent (this way not for IE and fireEvent)
    var error = false;

    if (!Browser.isIE) {
        try {
            event = new MouseEvent('click', {
                'view':       window,
                'bubbles':    true,
                'cancelable': true
            });
        }
        catch (e) {
            //browser doesn't support this action
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

if (!Browser.hasTouchEvents) {
    //B254111 - Recorder - hover does not freeze
    test('focusBlur.fixHoveredElement, focusBlur.freeHoveredElement', function () {
        var $parent = $('<div style="width:100px; height:100px; background-color: Red" class="parent">').appendTo($('body'));
        var $child  = $('<div style="width:50px; height:50px; background-color: Blue" class="child">').appendTo($parent);

        ok(!isHovered($parent[0]));
        ok(!isHovered($child[0]));

        FocusBlur.fixHoveredElement();

        hoverElement($parent[0]);
        ok(!isHovered($parent[0]));
        ok(!isHovered($child[0]));

        FocusBlur.freeHoveredElement();

        hoverElement($child[0]);
        ok(isHovered($parent[0]));
        ok(isHovered($child[0]));

        hoverElement($('body')[0]);
        ok(!isHovered($parent[0]));
        ok(!isHovered($child[0]));

        $parent.remove();
        $child.remove();
    });
}

//T239606 - TD15.1 - Errors raise on page http://demos111.mootools.net/Drag.Absolutely
test('attachEvent, fireEvent, detachEvent', function () {
    var el = NativeMethods.createElement.call(document, 'A');

    var attachEventExist = !!el.attachEvent;
    var fireEventExist   = !!el.fireEvent;
    var detachEventExist = !!el.detachEvent;

    if (attachEventExist || fireEventExist || detachEventExist)
        ok(NativeMethods.attachEvent && NativeMethods.fireEvent && NativeMethods.detachEvent);
    else {
        EventSandbox.overrideElement(el);

        ok(!el.attachEvent);
        ok(!el.fireEvent);
        ok(!el.detachEvent);
    }
});

//T137892 - Health monitor - incorrectly makes copy message event (taobao.com)
asyncTest('window.postMessage', function () {
    window.addEventListener('message', function (e) {
        try {
            e.stopPropagation();
            ok(true);
        }
        catch (e) {
            ok(false);
        }
        finally {
            start();
        }
    });

    eval(processScript('window.postMessage("hello", "*")'));
});

if (!Browser.isIE9) {
    //T203986 - TestCafe - A test failed in IE9, IE11 and Safari with different error messages
    asyncTest('override setTimeout error', function () {
        var str = 'success';

        setTimeout(function (msg) {
            strictEqual(msg, str);
            start();
        }, 10, str);
    });
}

//T261234 - All cases of the listener parameter aren\'t overrided in addEventListener function
asyncTest('special parameters for addEventListener', function () {
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

    Listeners.initElementListening(divEl);

    NativeMethods.addEventListener.call(divEl, 'click', eventObjOrigin);
    divEl.addEventListener('click', eventObjWrap);
    divEl.click();
});
