var browserUtils   = hammerhead.utils.browser;
var eventUtils     = hammerhead.utils.event;
var eventSimulator = hammerhead.sandbox.event.eventSimulator;

var $domElement = null;
var domElement  = null;
var raised      = false;

var lastTouchIdentifier = null;

QUnit.testStart(function () {
    $domElement         = $('<input type="text">').attr('id', 'domElement').appendTo('body');
    domElement          = $domElement[0];
    raised              = false;
    lastTouchIdentifier = null;
});

QUnit.testDone(function () {
    $domElement.remove();
});

var bindMouseEvent = function (eventType, btn) {
    var button = typeof btn === 'undefined' ? 0 : btn;

    domElement['on' + eventType] = function (e) {
        var ev = e || window.event;

        if (ev.button === button)
            raised = true;
    };
};

var bindKeyEvent = function (eventType, keyCode) {
    domElement['on' + eventType] = function (e) {
        var ev = e || window.event;

        if (ev.keyCode === keyCode)
            raised = true;
    };
};

test('mouse left button click', function () {
    bindMouseEvent('click', eventUtils.BUTTON.left);
    eventSimulator.click(domElement);
    ok(raised);
});

test('mouse double click', function () {
    bindMouseEvent('dblclick', eventUtils.BUTTON.left);
    eventSimulator.dblclick(domElement);
    ok(raised);
});

test('mouse right click', function () {
    bindMouseEvent('click', eventUtils.BUTTON.right);
    bindMouseEvent('mousedown', eventUtils.BUTTON.right);
    bindMouseEvent('mouseup', eventUtils.BUTTON.right);
    eventSimulator.rightclick(domElement);
    ok(raised);
});

test('mouse down', function () {
    bindMouseEvent('mousedown', eventUtils.BUTTON.left);
    eventSimulator.mousedown(domElement);
    ok(raised);
});

test('mouse up', function () {
    bindMouseEvent('mouseup', eventUtils.BUTTON.left);
    eventSimulator.mouseup(domElement);
    ok(raised);
});

test('mouse down right', function () {
    bindMouseEvent('mousedown', eventUtils.BUTTON.right);
    eventSimulator.mousedown(domElement, { button: eventUtils.BUTTON.right });
    ok(raised);
});

test('mouse up  right', function () {
    bindMouseEvent('mouseup', eventUtils.BUTTON.right);
    eventSimulator.mouseup(domElement, { button: eventUtils.BUTTON.right });
    ok(raised);
});

test('context menu', function () {
    bindMouseEvent('contextmenu', eventUtils.BUTTON.right);
    eventSimulator.contextmenu(domElement, { button: eventUtils.BUTTON.right });
    ok(raised);
});

test('mouse over', function () {
    bindMouseEvent('mouseover');
    eventSimulator.mouseover(domElement);
    ok(raised);
});

test('mouse move', function () {
    bindMouseEvent('mousemove');
    eventSimulator.mousemove(domElement);
    ok(raised);
});

test('mouse out', function () {
    bindMouseEvent('mouseout');
    eventSimulator.mouseout(domElement);
    ok(raised);
});

test('key press', function () {
    bindKeyEvent('keypress', 13);
    eventSimulator.keypress(domElement, { keyCode: 13 });
    ok(raised);
});

test('key up', function () {
    bindKeyEvent('keyup', 13);
    eventSimulator.keyup(domElement, { keyCode: 13 });
    ok(raised);
});

test('key down', function () {
    bindKeyEvent('keydown', 13);
    eventSimulator.keydown(domElement, { keyCode: 13 });
    ok(raised);
});

test('event with options (ctrl, alt, shift, meta)', function () {
    domElement['onclick'] = function (e) {
        var ev = e || window.event;

        if (ev.ctrlKey && ev.altKey && ev.shiftKey && ev.metaKey)
            raised = true;
    };
    eventSimulator.click(domElement, { ctrl: true, alt: true, shift: true, meta: true });
    ok(raised);
});

test('event with coords (clientX, clientY)', function () {
    var clientX = 10;
    var clientY = 10;

    domElement['onmousedown'] = function (e) {
        var ev = e || window.event;

        if (ev.clientX === clientX && ev.clientY === clientY && ev.button === eventUtils.BUTTON.left)
            raised = true;
    };
    eventSimulator.mousedown(domElement, { clientX: clientX, clientY: clientY });
    ok(raised);
});

test('blur', function () {
    var blured = false;

    domElement['onblur'] = function () {
        blured = true;
    };
    eventSimulator.blur(domElement);
    ok(blured);
});

if (!browserUtils.isFirefox) {
    test('window.event is not null', function () {
        var ev = null;

        domElement['onclick'] = function () {
            ev = window.event.type;
        };
        eventSimulator.click(domElement);
        strictEqual(ev, 'click');
    });
}

// NOTE: For touch devices.
if (browserUtils.hasTouchEvents) {
    var bindTouchEvent = function (eventType) {
        domElement['on' + eventType] = function (e) {
            var touchIdentifier = e.changedTouches[0].identifier;

            raised              = true;
            lastTouchIdentifier = touchIdentifier;
        };
    };

    // NOTE: Click (Touch) events are not raised when using a combination of
    // TestCafé 14.1.1 + KendoUI Mobile + iOS. (T112153)
    test('touchstart, touchend, touchmove', function () {
        var savedIdentifier = lastTouchIdentifier;

        bindTouchEvent('touchstart');
        bindTouchEvent('touchend');
        bindTouchEvent('touchmove');

        eventSimulator.touchstart(domElement);
        ok(raised);
        raised = false;
        notEqual(lastTouchIdentifier, savedIdentifier);
        savedIdentifier = lastTouchIdentifier;

        eventSimulator.touchmove(domElement);
        ok(raised);
        raised = false;
        strictEqual(lastTouchIdentifier, savedIdentifier);

        eventSimulator.touchend(domElement);
        ok(raised);
        raised = false;
        strictEqual(lastTouchIdentifier, savedIdentifier);

        eventSimulator.touchstart(domElement);
        notEqual(lastTouchIdentifier, savedIdentifier);
    });
}

if (browserUtils.isIE) {
    if (!browserUtils.isIE11) {
        test('preventing via the window.event property', function () {
            var $checkBox = $('<input type="checkbox">')
                .click(function () {
                    window.event.returnValue = false;
                })
                .appendTo('body');

            var initChecked = $checkBox[0].checked;

            eventSimulator.click($checkBox[0]);
            strictEqual(initChecked, $checkBox[0].checked);

            $checkBox.remove();
        });
    }

    test('cancel bubble via the window.event property', function () {
        var $checkBox           = $('<input type="checkbox" />')
            .click(function () {
                window.event.cancelBubble = true;
            })
            .appendTo('body');
        var documentClickRaised = false;

        document.addEventListener('click', function () {
            documentClickRaised = true;
        });

        eventSimulator.click($checkBox[0]);

        ok(!documentClickRaised);

        $checkBox.remove();
    });
}

if (eventUtils.hasPointerEvents) {
    test('pointer down', function () {
        if (browserUtils.isIE10)
            bindMouseEvent('mspointerdown', eventUtils.BUTTON.left);
        else
            bindMouseEvent('pointerdown', eventUtils.BUTTON.left);
        eventSimulator.mousedown(domElement);
        ok(raised);
    });
}

module('regression');

if (browserUtils.isIE) {
    if (!browserUtils.isIE11) {
        test('window.event save/restore for сlick (B237144)', function () {
            var $textInput = $('<input type="text">').appendTo('body');

            var $checkBox1 = $('<input type="checkbox">')
                .attr('id', 'cb1')
                .appendTo('body');

            var $checkBox2 = $('<input type="checkbox">')
                .attr('id', 'cb2')
                .appendTo('body');

            $checkBox1[0].onclick = function () {
                $checkBox2[0].click();
                window.event.returnValue = false;
            };

            $checkBox2[0].addEventListener('click', function () {
                $checkBox2[0].focus();
                window.event.returnValue = false;
            });

            var initChecked1 = $checkBox1[0].checked;
            var initChecked2 = $checkBox2[0].checked;

            eventSimulator.click($checkBox1[0]);

            strictEqual(initChecked1, $checkBox1[0].checked);
            strictEqual(initChecked2, $checkBox2[0].checked);

            $checkBox1.remove();
            $checkBox2.remove();
            $textInput.remove();
        });
    }

    test('window.event must contain toElement and fromElement properties for mouseout and mouseover events (B237405)', function () {
        var mouseoutChecked  = false;
        var mouseoverChecked = false;

        var $divFrom = $('<div>').mouseout(onmouseout).appendTo('body');
        var $divTo   = $('<div>').mouseover(onmouseover).appendTo('body');

        function onmouseout () {
            mouseoutChecked = window.event && window.event.fromElement === $divFrom[0] &&
                              window.event.toElement === $divTo[0];
        }

        function onmouseover () {
            mouseoverChecked = window.event && window.event.fromElement === $divFrom[0] &&
                               window.event.toElement === $divTo[0];
        }

        eventSimulator.mouseout($divFrom[0], { relatedTarget: $divTo[0] });
        eventSimulator.mouseover($divTo[0], { relatedTarget: $divFrom[0] });
        ok(mouseoutChecked, 'mouseout checked');
        ok(mouseoverChecked, 'mouseover checked');
        $divFrom.remove();
        $divTo.remove();
    });
}

if (!browserUtils.isFirefox) {
    asyncTest('window event should not be undefined inside iframe handler (B254199)', function () {
        var src    = window.QUnitGlobals.getResourceUrl('../../../data/event-sandbox/event-simulator.html');
        var iframe = document.createElement('iframe');

        window.QUnitGlobals.waitForIframe(iframe)
            .then(function () {
                iframe.contentDocument.addEventListener('click', function () {
                    if (typeof iframe.contentWindow.event === 'undefined')
                        window.top.error = true;
                });

                eventSimulator.click(iframe.contentDocument.body);

                ok(!window.top.error);
                iframe.parentNode.removeChild(iframe);
                start();
            });
        iframe.setAttribute('src', src);
        document.body.appendChild(iframe);
    });

    asyncTest('window.event becomes empty when a click event handler triggers the click event on a different element in IE11 (GH-226)', function () {
        var src    = window.QUnitGlobals.getResourceUrl('../../../data/event-sandbox/event-simulator.html');
        var iframe = document.createElement('iframe');

        iframe.setAttribute('src', src);
        window.QUnitGlobals.waitForIframe(iframe)
            .then(function () {
                eventSimulator.click(iframe.contentDocument.getElementById('span'));

                ok(!window.top.error);
                iframe.parentNode.removeChild(iframe);
                start();
            });
        document.body.appendChild(iframe);
    });

    asyncTest('"submit" should bubble (GH-318)', function () {
        expect(0);

        var form = document.createElement('form');

        form.setAttribute('onsubmit', 'return false;');
        document.body.appendChild(form);

        function eventHandler () {
            window.removeEventListener('submit', eventHandler);
            start();
        }

        window.addEventListener('submit', eventHandler);
        eventSimulator.submit(form);
    });

    test('"input" and "change" should bubble; "focus", "blur", "selectionchange" should not (GH-318)', function () {
        var $input = $('<input>')
            .appendTo('body');

        var firedEvents = {};

        var eventTypes = ['focus', 'blur', 'input', 'change', 'selectionchange'];

        function eventHandler (e) {
            firedEvents[e.type] = true;
        }

        function getEventTarget (eventType) {
            if (eventType === 'selectionchange')
                return window.document;

            return $input[0];
        }

        eventTypes.forEach(function (eventType) {
            window.addEventListener(eventType, eventHandler);

            eventSimulator[eventType](getEventTarget(eventType));

            window.removeEventListener(eventType, eventHandler);
        });

        $input.remove();

        deepEqual(firedEvents, {
            input:  true,
            change: true
        });
    });
}

asyncTest('hammerhead functions should not be in strict mode (GH-344)', function () {
    var button = $('<button>').appendTo('body');

    button.click(function () {
        var exceptionRaised = false;

        try {
            /*eslint-disable no-caller*/

            var caller = arguments.callee.caller;

            /*eslint-enable no-caller*/

            while (caller && caller.arguments && caller.arguments.callee)
                caller = caller.arguments.callee.caller;
        }
        catch (e) {
            exceptionRaised = true;
        }

        ok(!exceptionRaised, 'should not throw an exception');
        button.remove();
        start();
    });

    eventSimulator.click(button[0]);
});
asyncTest('should not define window.event property if event is raised in iframe for element of top window', function () {
    var src    = window.QUnitGlobals.getResourceUrl('../../../data/event-sandbox/event-simulator.html');
    var iframe = document.createElement('iframe');

    window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            var iframeWindow         = iframe.contentWindow;
            var iframeEventSimulator = iframeWindow['%hammerhead%'].sandbox.event.eventSimulator;
            var error                = null;

            try {
                iframeEventSimulator.keydown(domElement, { keyCode: 13 });
            }
            catch (err) {
                error = err;
            }

            iframe.parentNode.removeChild(iframe);
            ok(!error);
            start();
        });

    iframe.setAttribute('src', src);
    document.body.appendChild(iframe);
});

