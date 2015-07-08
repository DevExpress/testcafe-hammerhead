var Browser        = Hammerhead.get('./util/browser');
var Event          = Hammerhead.get('./util/event');
var EventSimulator = Hammerhead.get('./sandboxes/event/simulator');

var $domElement = null;
var domElement  = null;
var raised      = false;

var lastTouchIdentifier = null;

QUnit.testStart = function () {
    $domElement         = $('<input type="text">').attr('id', 'domElement').appendTo('body');
    domElement          = $domElement[0];
    raised              = false;
    lastTouchIdentifier = null;
};

QUnit.testDone = function () {
    $domElement.remove();
};

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
    bindMouseEvent('click', Event.BUTTON.LEFT);
    EventSimulator.click(domElement);
    ok(raised);
});

test('mouse double click', function () {
    bindMouseEvent('dblclick', Event.BUTTON.LEFT);
    EventSimulator.dblclick(domElement);
    ok(raised);
});

test('mouse right click', function () {
    bindMouseEvent('click', Event.BUTTON.RIGHT);
    bindMouseEvent('mousedown', Event.BUTTON.RIGHT);
    bindMouseEvent('mouseup', Event.BUTTON.RIGHT);
    EventSimulator.rightclick(domElement);
    ok(raised);
});

test('mouse down', function () {
    bindMouseEvent('mousedown', Event.BUTTON.LEFT);
    EventSimulator.mousedown(domElement);
    ok(raised);
});

test('mouse up', function () {
    bindMouseEvent('mouseup', Event.BUTTON.LEFT);
    EventSimulator.mouseup(domElement);
    ok(raised);
});

test('mouse down right', function () {
    bindMouseEvent('mousedown', Event.BUTTON.RIGHT);
    EventSimulator.mousedown(domElement, { button: Event.BUTTON.RIGHT });
    ok(raised);
});

test('mouse up  right', function () {
    bindMouseEvent('mouseup', Event.BUTTON.RIGHT);
    EventSimulator.mouseup(domElement, { button: Event.BUTTON.RIGHT });
    ok(raised);
});

test('context menu', function () {
    bindMouseEvent('contextmenu', Event.BUTTON.RIGHT);
    EventSimulator.contextmenu(domElement, { button: Event.BUTTON.RIGHT });
    ok(raised);
});

test('mouse over', function () {
    bindMouseEvent('mouseover');
    EventSimulator.mouseover(domElement);
    ok(raised);
});

test('mouse move', function () {
    bindMouseEvent('mousemove');
    EventSimulator.mousemove(domElement);
    ok(raised);
});

test('mouse out', function () {
    bindMouseEvent('mouseout');
    EventSimulator.mouseout(domElement);
    ok(raised);
});

test('key press', function () {
    bindKeyEvent('keypress', 13);
    EventSimulator.keypress(domElement, { keyCode: 13 });
    ok(raised);
});

test('key up', function () {
    bindKeyEvent('keyup', 13);
    EventSimulator.keyup(domElement, { keyCode: 13 });
    ok(raised);
});

test('key down', function () {
    bindKeyEvent('keydown', 13);
    EventSimulator.keydown(domElement, { keyCode: 13 });
    ok(raised);
});

test('event with options (ctrl, alt, shift, meta)', function () {
    domElement['onclick'] = function (e) {
        var ev = e || window.event;

        if (ev.ctrlKey && ev.altKey && ev.shiftKey && ev.metaKey)
            raised = true;
    };
    EventSimulator.click(domElement, { ctrl: true, alt: true, shift: true, meta: true });
    ok(raised);
});

test('event with coords (clientX, clientY)', function () {
    var clientX = 10;
    var clientY = 10;

    domElement['onmousedown'] = function (e) {
        var ev = e || window.event;

        if (ev.clientX === clientX && ev.clientY === clientY && ev.button === Event.BUTTON.LEFT)
            raised = true;
    };
    EventSimulator.mousedown(domElement, { clientX: clientX, clientY: clientY });
    ok(raised);
});

test('blur', function () {
    var blured = false;

    domElement['onblur'] = function () {
        blured = true;
    };
    EventSimulator.blur(domElement);
    ok(blured);
});

if (!Browser.isMozilla) {
    test('window.event is not null', function () {
        var ev = null;

        domElement['onclick'] = function () {
            ev = window.event.type;
        };
        EventSimulator.click(domElement);
        strictEqual(ev, 'click');
    });
}

// NOTE: for touch devices
if (Browser.hasTouchEvents) {
    var bindTouchEvent = function (eventType) {
        domElement['on' + eventType] = function (e) {
            var touchIdentifier = e.changedTouches[0].identifier;

            raised              = true;
            lastTouchIdentifier = touchIdentifier;
        };
    };

    //T112153 - Click (Touch) events are not raised when using a combination of TestCafé 14.1.1 + KendoUI Mobile + iOS
    test('touchstart, touchend, touchmove', function () {
        var savedIdentifier = lastTouchIdentifier;

        bindTouchEvent('touchstart');
        bindTouchEvent('touchend');
        bindTouchEvent('touchmove');

        EventSimulator.touchstart(domElement);
        ok(raised);
        raised              = false;
        notEqual(lastTouchIdentifier, savedIdentifier);
        savedIdentifier     = lastTouchIdentifier;

        EventSimulator.touchmove(domElement);
        ok(raised);
        raised              = false;
        strictEqual(lastTouchIdentifier, savedIdentifier);

        EventSimulator.touchend(domElement);
        ok(raised);
        raised              = false;
        strictEqual(lastTouchIdentifier, savedIdentifier);

        EventSimulator.touchstart(domElement);
        notEqual(lastTouchIdentifier, savedIdentifier);
    });
}

if (Browser.isIE) {
    if (!Browser.isIE11) {
        test('preventing via the window.event property', function () {
            var $checkBox = $('<input type="checkbox">')
                .click(function () {
                    window.event.returnValue = false;
                })
                .appendTo('body');

            var initChecked = $checkBox[0].checked;

            EventSimulator.click($checkBox[0]);
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

        EventSimulator.click($checkBox[0]);

        ok(!documentClickRaised);

        $checkBox.remove();
    });
}

if (Browser.isIE) {
    if (!Browser.isIE11) {
        //B237144 - IE9, IE10 - Unexpected postback occurs when call DoClick() method of the ASPxButton client instance with disabled AutoPostBack property
        test('nativeClick', function () {
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

            EventSimulator.click($checkBox1[0]);

            strictEqual(initChecked1, $checkBox1[0].checked);
            strictEqual(initChecked2, $checkBox2[0].checked);

            $checkBox1.remove();
            $checkBox2.remove();
            $textInput.remove();
        });
    }

    test('B237405 - window.event contains toElement and fromElement properties for mouseout and mouseover events', function () {
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

        EventSimulator.mouseout($divFrom[0], { relatedTarget: $divTo[0] });
        EventSimulator.mouseover($divTo[0], { relatedTarget: $divFrom[0] });
        ok(mouseoutChecked, 'mouseout checked');
        ok(mouseoverChecked, 'mouseover checked');
        $divFrom.remove();
        $divTo.remove();
    });
}

