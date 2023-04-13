var nativeMethods    = hammerhead.nativeMethods;
var browserUtils     = hammerhead.utils.browser;
var eventUtils       = hammerhead.utils.event;
var featureDetection = hammerhead.utils.featureDetection;
var eventSimulator   = hammerhead.sandbox.event.eventSimulator;
var DataTransfer     = hammerhead.sandbox.event.DataTransfer;
var DragDataStore    = hammerhead.sandbox.event.DragDataStore;

var $domElement = null;
var domElement  = null;
var raised      = false;
var bubbled     = false;
var detail      = 0;

var lastTouchIdentifier = null;

QUnit.testStart(function () {
    $domElement         = $('<input type="text">').attr('id', 'domElement').appendTo('body');
    domElement          = $domElement[0];
    raised              = false;
    bubbled             = false;
    lastTouchIdentifier = null;
    detail              = 0;
});

QUnit.testDone(function () {
    $domElement.remove();
});

var bindMouseEvent = function (eventType, btn) {
    var button = typeof btn === 'undefined' ? 0 : btn;

    domElement['on' + eventType] = function (e) {
        var ev = e || window.event;

        if (ev.button === button) {
            raised = true;
            detail = ev.detail;
        }
    };
};

var bindKeyEvent = function (eventType, eventObj) {
    domElement['on' + eventType] = function (e) {
        var ev = e || window.event;

        if (ev.keyCode === eventObj.keyCode &&
            ev.charCode === (eventObj.charCode || 0) &&
            ev.which === eventObj.keyCode &&
            ev.shiftKey === (eventObj.shift || false) &&
            ev.altKey === (eventObj.alt || false))
            raised = true;
    };
};

var bubbleEventListener = function () {
    bubbled = true;
};

var bindBubbleListener = function (eventType) {
    document.addEventListener(eventType, bubbleEventListener);
};

var removeBubbleListener = function (eventType) {
    document.removeEventListener(eventType, bubbleEventListener);
};

test('mouse left button click', function () {
    bindMouseEvent('click', eventUtils.BUTTON.left);
    eventSimulator.click(domElement);
    ok(raised);
    strictEqual(detail, 1, 'should provide the correct event.detail value');
});

test('mouse double click', function () {
    bindMouseEvent('dblclick', eventUtils.BUTTON.left);
    eventSimulator.dblclick(domElement);
    ok(raised);
    strictEqual(detail, 2, 'should provide the correct event.detail value');
});

test('mouse right click', function () {
    bindMouseEvent('click', eventUtils.BUTTON.right);
    bindMouseEvent('mousedown', eventUtils.BUTTON.right);
    bindMouseEvent('mouseup', eventUtils.BUTTON.right);
    eventSimulator.rightclick(domElement);
    ok(raised);
    strictEqual(detail, 1, 'should provide the correct event.detail value');
});

test('mouse down left', function () {
    bindMouseEvent('mousedown', eventUtils.BUTTON.left);
    eventSimulator.mousedown(domElement);
    ok(raised);
    strictEqual(detail, 1, 'should provide the correct event.detail value');
});

test('mouse up left', function () {
    bindMouseEvent('mouseup', eventUtils.BUTTON.left);
    eventSimulator.mouseup(domElement);
    ok(raised);
    strictEqual(detail, 1, 'should provide the correct event.detail value');
});

test('mouse down right', function () {
    bindMouseEvent('mousedown', eventUtils.BUTTON.right);
    eventSimulator.mousedown(domElement, { button: eventUtils.BUTTON.right });
    ok(raised);
    strictEqual(detail, 1, 'should provide the correct event.detail value');
});

test('mouse up right', function () {
    bindMouseEvent('mouseup', eventUtils.BUTTON.right);
    eventSimulator.mouseup(domElement, { button: eventUtils.BUTTON.right });
    ok(raised);
    strictEqual(detail, 1, 'should provide the correct event.detail value');
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

test('mouse enter', function () {
    var eventName = 'mouseenter';

    bindMouseEvent(eventName);
    bindBubbleListener(eventName);

    eventSimulator.mouseenter(domElement);

    ok(raised);
    ok(!bubbled);

    removeBubbleListener(eventName);
});

test('mouse leave', function () {
    var eventName = 'mouseleave';

    bindMouseEvent(eventName);
    bindBubbleListener(eventName);

    eventSimulator.mouseleave(domElement);

    ok(raised);
    ok(!bubbled);

    removeBubbleListener(eventName);
});

test('key down', function () {
    var eventObj = { keyCode: 13, shift: true, alt: true };

    bindKeyEvent('keydown', eventObj);
    eventSimulator.keydown(domElement, eventObj);
    ok(raised);
});

test('key press', function () {
    var eventObj = { keyCode: 97, charCode: 97 };

    bindKeyEvent('keypress', eventObj);
    eventSimulator.keypress(domElement, eventObj);
    ok(raised);
});

test('key up', function () {
    var eventObj = { keyCode: 13 };

    bindKeyEvent('keyup', eventObj);
    eventSimulator.keyup(domElement, eventObj);
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

test('event with coords (clientX, clientY, screenX, screenY)', function () {
    var clientX = 1;
    var clientY = 2;
    var screenX = 3;
    var screenY = 4;

    domElement.onmousedown = function (e) {
        var coordsAreCorrect = e.clientX === clientX && e.clientY === clientY && e.screenX === screenX && e.screenY === screenY;

        raised = coordsAreCorrect && e.button === eventUtils.BUTTON.left;
    };

    eventSimulator.mousedown(domElement, { clientX: clientX, clientY: clientY, screenX: screenX, screenY: screenY });
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

test('focusin', function () {
    var focusInRaised = false;

    domElement.addEventListener('focusin', function () {
        focusInRaised = true;
    });
    eventSimulator.focusin(domElement);
    ok(focusInRaised);
});

test('focusout', function () {
    var focusOutRaised = false;

    domElement.addEventListener('focusout', function () {
        focusOutRaised = true;
    });
    eventSimulator.focusout(domElement);
    ok(focusOutRaised);
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
if (featureDetection.hasTouchEvents) {
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

    if (browserUtils.isChrome) {
        test('touch events raise pointer events', function () {
            const eventLog = [];

            const handler = function (e) {
                eventLog.push(e.type);

                strictEqual(e.pointerType, 'touch');
            };

            domElement.addEventListener('pointerdown', handler);
            domElement.addEventListener('pointermove', handler);
            domElement.addEventListener('pointerup', handler);

            eventSimulator.touchstart(domElement);
            eventSimulator.touchmove(domElement);
            eventSimulator.touchend(domElement);

            deepEqual(eventLog, ['pointerdown', 'pointermove', 'pointerup']);
        });
    }
}

if (eventUtils.hasPointerEvents) {
    test('pointer down', function () {
        bindMouseEvent('pointerdown', eventUtils.BUTTON.left);

        if (featureDetection.isTouchDevice) {
            eventSimulator.touchstart(domElement);

            ok(raised);

            raised = false;
        }

        eventSimulator.mousedown(domElement);

        if (featureDetection.isTouchDevice)
            notOk(raised);
        else
            ok(raised);

        raised = false;
    });
}

if (!browserUtils.isSafari && !browserUtils.isAndroid) {
    asyncTest("keyboard methods should pass 'key' event option", function () {
        var eventOptions = { keyCode: 13, key: 'Enter' };

        var checkEvent = function (event) {
            strictEqual(event.key, 'Enter');
            notOk('keyIdentifier' in event);
        };

        domElement.addEventListener('keydown', checkEvent);
        domElement.addEventListener('keypress', checkEvent);
        domElement.addEventListener('keyup', checkEvent);

        eventSimulator.keydown(domElement, eventOptions);
        eventSimulator.keypress(domElement, eventOptions);
        eventSimulator.keyup(domElement, eventOptions);

        window.setTimeout(start, 50);
    });
}
else {
    asyncTest("keyboard methods should pass 'keyIdentifier' event option", function () {
        var eventOptions = { keyCode: 13, keyIdentifier: 'Enter' };

        var checkEvent = function (event) {
            strictEqual(event.keyIdentifier, event.type === 'keypress' ? '' : 'Enter');

            // NOTE: Until to Safari iOS 10.3
            if (!browserUtils.isAndroid &&
                browserUtils.compareVersions([browserUtils.webkitVersion, '603.1.30']) === -1)
                notOk('key' in event);
        };

        domElement.addEventListener('keydown', checkEvent);
        domElement.addEventListener('keypress', checkEvent);
        domElement.addEventListener('keyup', checkEvent);

        eventSimulator.keydown(domElement, eventOptions);
        eventSimulator.keypress(domElement, { keyCode: 13, keyIdentifier: '' });
        eventSimulator.keyup(domElement, eventOptions);

        window.setTimeout(start, 50);
    });
}

test('drag and drop events', function () {
    var anchor = document.createElement('a');
    var input  = document.createElement('input');

    nativeMethods.anchorHrefSetter.call(anchor, 'http://example.com');
    anchor.setAttribute('draggable', true);
    anchor.id = 'link';
    input.id  = 'input';

    document.body.appendChild(anchor);
    document.body.appendChild(input);

    var eventLog     = [];
    var dataTransfer = new DataTransfer(new DragDataStore());

    function dragEventListener (e) {
        eventLog.push(e.type + '-' + (e.currentTarget.id || 'document'));

        ok(e.dataTransfer);
    }

    var tracedEvents = ['dragstart', 'drag', 'dragenter', 'dragover', 'dragleave', 'drop', 'dragend'];

    for (var i = 0; i < tracedEvents.length; i++) {
        var ev = tracedEvents[i];

        document.addEventListener(ev, dragEventListener);
        anchor.addEventListener(ev, dragEventListener);
        input.addEventListener(ev, dragEventListener);
    }

    eventSimulator.dragstart(anchor, { dataTransfer: dataTransfer });
    eventSimulator.drag(anchor, { dataTransfer: dataTransfer });
    eventSimulator.dragenter(anchor, { dataTransfer: dataTransfer });
    eventSimulator.dragover(anchor, { dataTransfer: dataTransfer });
    eventSimulator.dragleave(anchor, { dataTransfer: dataTransfer });
    eventSimulator.drop(input, { dataTransfer: dataTransfer });
    eventSimulator.dragend(anchor, { dataTransfer: dataTransfer });

    var expectedEvents = [
        'dragstart-link',
        'dragstart-document',
        'drag-link',
        'drag-document',
        'dragenter-link',
        'dragenter-document',
        'dragover-link',
        'dragover-document',
        'dragleave-link',
        'dragleave-document',
        'drop-input',
        'drop-document',
        'dragend-link',
        'dragend-document',
    ];

    strictEqual(eventLog.join('\n'), expectedEvents.join('\n'));

    document.body.removeChild(anchor);
    document.body.removeChild(input);
});

// NOTE: Firefox does not support textInput event
if (!browserUtils.isFirefox) {
    test('text input', function () {
        var textInputEventName = 'textInput';

        var handler = function (e) {
            var ev = e || window.event;

            if (ev instanceof Event && ev instanceof TextEvent && e.data === 'Hello')
                raised = true;
        };

        document.addEventListener(textInputEventName, handler);
        eventSimulator.textInput(domElement, 'Hello');
        document.removeEventListener(textInputEventName, handler);

        ok(raised);
    });
}

// NOTE: The `beforeinput` event works only in Chrome/Safari
if (!browserUtils.isFirefox) {
    test('before input', function () {
        var handler = function (e) {
            if (e instanceof Event && e instanceof InputEvent && e.data === 'Hello')
                raised = true;
        };

        var eventName = 'beforeinput';

        document.addEventListener(eventName, handler);
        eventSimulator.beforeInput(domElement, 'Hello');
        document.removeEventListener(eventName, handler);

        ok(raised);
    });
}

test('mouse event buttons properties', function () {
    var actualLog = {};

    var getButtonsProperty = function (buttons) {
        return browserUtils.isSafari ? void 0 : buttons;
    };

    var eventHandler = function (e) {
        var args = {
            type:    e.type,
            button:  e.button,
            buttons: getButtonsProperty(e.buttons),
            which:   e.which,
        };

        actualLog[e.type] = args;
    };

    var getArgs = function (type, button, buttons, which) {
        return {
            type:    type,
            button:  button,
            buttons: getButtonsProperty(buttons),
            which:   which,
        };
    };

    var getExpectedMouseMoveEvents = function (type) {
        return [
            {
                expected: getArgs(type, eventUtils.BUTTON.left, eventUtils.BUTTONS_PARAMETER.noButton,
                    browserUtils.isWebKit ? eventUtils.WHICH_PARAMETER.noButton : eventUtils.WHICH_PARAMETER.leftButton),
                action: function () {
                    eventSimulator[type](domElement);
                },
            },
            {
                expected: getArgs(type, eventUtils.BUTTON.left, eventUtils.BUTTONS_PARAMETER.leftButton,
                    eventUtils.WHICH_PARAMETER.leftButton),
                action: function () {
                    eventSimulator[type](domElement, { buttons: eventUtils.BUTTONS_PARAMETER.leftButton });
                },
            },
            {
                expected: getArgs(type, eventUtils.BUTTON.left, eventUtils.BUTTONS_PARAMETER.rightButton,
                    browserUtils.isWebKit ? eventUtils.WHICH_PARAMETER.rightButton : eventUtils.WHICH_PARAMETER.leftButton),
                action: function () {
                    eventSimulator[type](domElement, { buttons: eventUtils.BUTTONS_PARAMETER.rightButton });
                },
            }];
    };

    const testCases = [
        {
            expected:
                    getArgs(
                        'click',
                        eventUtils.BUTTON.left,
                        eventUtils.BUTTONS_PARAMETER.noButton,
                        eventUtils.WHICH_PARAMETER.leftButton),
            action: function () {
                eventSimulator.click(domElement);
            },
        },
        {
            expected:
                getArgs(
                    'dblclick',
                    eventUtils.BUTTON.left,
                    eventUtils.BUTTONS_PARAMETER.noButton,
                    eventUtils.WHICH_PARAMETER.leftButton),
            action: function () {
                eventSimulator.dblclick(domElement);
            },
        },
        {
            expected:
                getArgs(
                    'contextmenu',
                    eventUtils.BUTTON.right,
                    eventUtils.BUTTONS_PARAMETER.noButton,
                    eventUtils.WHICH_PARAMETER.rightButton),
            action: function () {
                eventSimulator.contextmenu(domElement);
            },
        }, {
            expected:
                getArgs(
                    'mousedown',
                    eventUtils.BUTTON.left,
                    eventUtils.BUTTONS_PARAMETER.leftButton,
                    eventUtils.WHICH_PARAMETER.leftButton),
            action: function () {
                eventSimulator.mousedown(domElement);
            },
        },
        {
            expected:
                getArgs(
                    'mousedown',
                    eventUtils.BUTTON.right,
                    eventUtils.BUTTONS_PARAMETER.rightButton,
                    eventUtils.WHICH_PARAMETER.rightButton),
            action: function () {
                eventSimulator.mousedown(domElement, { button: eventUtils.BUTTON.right });
            },
        },
        {
            expected:
                getArgs(
                    'mouseup',
                    eventUtils.BUTTON.left,
                    eventUtils.BUTTONS_PARAMETER.noButton,
                    eventUtils.WHICH_PARAMETER.leftButton),
            action: function () {
                eventSimulator.mouseup(domElement);
            },
        },
        {
            expected:
                getArgs(
                    'mouseup',
                    eventUtils.BUTTON.right,
                    eventUtils.BUTTONS_PARAMETER.noButton,
                    eventUtils.WHICH_PARAMETER.rightButton),
            action: function () {
                eventSimulator.mouseup(domElement, { button: eventUtils.BUTTON.right });
            },
        },
    ]
        .concat(getExpectedMouseMoveEvents('mousemove'))
        .concat(getExpectedMouseMoveEvents('mouseover'))
        .concat(getExpectedMouseMoveEvents('mouseout'))
        .concat(getExpectedMouseMoveEvents('mouseenter'))
        .concat(getExpectedMouseMoveEvents('mouseleave'));

    domElement.addEventListener('click', eventHandler);
    domElement.addEventListener('dblclick', eventHandler);
    domElement.addEventListener('contextmenu', eventHandler);
    domElement.addEventListener('mousedown', eventHandler);
    domElement.addEventListener('mouseup', eventHandler);
    domElement.addEventListener('mouseover', eventHandler);
    domElement.addEventListener('mouseout', eventHandler);
    domElement.addEventListener('mouseenter', eventHandler);
    domElement.addEventListener('mouseleave', eventHandler);
    domElement.addEventListener('mousemove', eventHandler);

    testCases.forEach(function (testCase) {
        testCase.action();

        deepEqual(actualLog[testCase.expected.type], testCase.expected);
    });
});

test('timestamp', function () {
    var options = { timeStamp: 1000 };

    domElement.addEventListener('click', function (event) {
        strictEqual(event.timeStamp, 1000);
    });

    eventSimulator.click(domElement, options);
});

module('mouse events on disabled elements', {
    beforeEach: function () {
        var eventLog = [];

        this.mouseEventHandler = function (event) {
            eventLog.push(event.type);
        };

        this.getEventLog = function () {
            return eventLog;
        };
    },
}, function () {
    test('<div>', function () {
        var div = document.createElement('div');

        document.body.appendChild(div);

        div.disabled    = true;
        div.innerText   = 'text';

        div.addEventListener('mousedown', this.mouseEventHandler);
        div.addEventListener('mouseup', this.mouseEventHandler);
        div.addEventListener('click', this.mouseEventHandler);

        eventSimulator.mousedown(div);
        eventSimulator.click(div);
        eventSimulator.mouseup(div);

        deepEqual(this.getEventLog(), ['mousedown', 'click', 'mouseup']);

        document.body.removeChild(div);
    });

    test('<button disabled><span></span></button> (GH-TC-5240)', function () {
        var button   = document.createElement('button');
        var span     = document.createElement('span');

        document.body.appendChild(button);
        button.appendChild(span);

        button.disabled = true;

        span.addEventListener('mousedown', this.mouseEventHandler);
        span.addEventListener('mouseup', this.mouseEventHandler);
        span.addEventListener('click', this.mouseEventHandler);

        eventSimulator.mousedown(span);
        eventSimulator.click(span);
        eventSimulator.mouseup(span);

        deepEqual(this.getEventLog(), [
            'mousedown',
            'click',
            'mouseup',
        ]);

        document.body.removeChild(button);
    });

    test('<button disabled><input></input></button>  (GH-TC-5240)', function () {
        var button   = document.createElement('button');
        var input    = document.createElement('input');

        document.body.appendChild(button);
        button.appendChild(input);

        button.disabled = true;

        input.addEventListener('mousedown', this.mouseEventHandler);
        input.addEventListener('mouseup', this.mouseEventHandler);
        input.addEventListener('click', this.mouseEventHandler);

        eventSimulator.mousedown(input);
        eventSimulator.click(input);
        eventSimulator.mouseup(input);

        deepEqual(this.getEventLog(), []);

        document.body.removeChild(button);
    });

    test('custom elements (GH-2346)', function () {
        function DisabledCustomElement () {
            return Reflect.construct(HTMLElement, [], this.constructor);
        }

        DisabledCustomElement.prototype = Object.create(HTMLElement.prototype);
        DisabledCustomElement.prototype.constructor = DisabledCustomElement;

        Object.setPrototypeOf(DisabledCustomElement, HTMLElement);

        customElements.define('disabled-cutsom-element', DisabledCustomElement);

        var disabledCustomElement = document.createElement('disabled-cutsom-element');
        var span                  = document.createElement('span');

        document.body.appendChild(disabledCustomElement);
        disabledCustomElement.appendChild(span);

        disabledCustomElement.setAttribute('disabled', true);

        span.addEventListener('mousedown', this.mouseEventHandler);
        span.addEventListener('mouseup', this.mouseEventHandler);
        span.addEventListener('click', this.mouseEventHandler);

        eventSimulator.mousedown(span);
        eventSimulator.click(span);
        eventSimulator.mouseup(span);

        deepEqual(this.getEventLog(), ['mousedown', 'click', 'mouseup']);

        document.body.removeChild(disabledCustomElement);
    });
});

module('regression');

if (!browserUtils.isFirefox) {
    test('window event should not be undefined inside iframe handler (B254199)', function () {
        return createTestIframe({ src: getSameDomainPageUrl('../../../data/event-sandbox/event-simulator.html') })
            .then(function (iframe) {
                iframe.contentDocument.addEventListener('click', function () {
                    if (typeof iframe.contentWindow.event === 'undefined')
                        window.top.error = true;
                });

                eventSimulator.click(iframe.contentDocument.body);

                ok(!window.top.error);
            });
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
            change: true,
        });
    });
}

asyncTest('hammerhead functions should not be in strict mode (GH-344)', function () {
    var button = $('<button>').appendTo('body');

    button.click(function () {
        var exceptionRaised = false;

        try {
            // eslint-disable-next-line no-caller
            var caller = arguments.callee.caller;

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

test('should not define the window.event property if the event is raised in iframe for the element of top window', function () {
    return createTestIframe({ src: getSameDomainPageUrl('../../../data/event-sandbox/event-simulator.html') })
        .then(function (iframe) {
            var iframeEventSimulator = iframe.contentWindow['%hammerhead%'].sandbox.event.eventSimulator;

            iframeEventSimulator.keydown(domElement, { keyCode: 13 });
        })
        .catch(function (err) {
            return err;
        })
        .then(function (err) {
            ok(!err, err);
        });
});

test('wrong type of the key event (GH-941)', function () {
    domElement.onkeydown = function (e) {
        var ev = e || window.event;

        if (ev instanceof Event && ev instanceof KeyboardEvent)
            raised = true;
    };

    eventSimulator.keydown(domElement);
    ok(raised);
});

test('wrong type of the focus event (GH-947)', function () {
    domElement.onfocus = function (e) {
        var ev = e || window.event;

        if (ev instanceof Event && ev instanceof FocusEvent)
            raised = true;
    };

    eventSimulator.focus(domElement);
    ok(raised);
});

test('wrong type of the blur event (GH-947)', function () {
    domElement.onblur = function (e) {
        var ev = e || window.event;

        if (ev instanceof Event && ev instanceof FocusEvent)
            raised = true;
    };

    eventSimulator.blur(domElement);
    ok(raised);
});

test('specific events has the `composed: true` property', function () {
    var log = {};

    var expectedLog = {
        'blur':        true,
        'focus':       true,
        'focusin':     true,
        'focusout':    true,
        'click':       true,
        'dblclick':    true,
        'mousedown':   true,
        'mousemove':   true,
        'mouseout':    true,
        'mouseover':   true,
        'mouseup':     true,
        'beforeinput': true,
        'input':       true,
        'keydown':     true,
        'keyup':       true,
    };

    function handler (e) {
        log[e.type] = e.composed;
    }

    domElement.addEventListener('blur', handler);
    domElement.addEventListener('focus', handler);
    domElement.addEventListener('focusin', handler);
    domElement.addEventListener('focusout', handler);
    domElement.addEventListener('click', handler);
    domElement.addEventListener('dblclick', handler);
    domElement.addEventListener('mousedown', handler);
    domElement.addEventListener('mousemove', handler);
    domElement.addEventListener('mouseout', handler);
    domElement.addEventListener('mouseover', handler);
    domElement.addEventListener('mouseup', handler);
    domElement.addEventListener('beforeinput', handler);
    domElement.addEventListener('input', handler);
    domElement.addEventListener('keyup', handler);
    domElement.addEventListener('keydown', handler);
    domElement.addEventListener('keyup', handler);

    eventSimulator.blur(domElement);
    eventSimulator.focus(domElement);
    eventSimulator.focusin(domElement);
    eventSimulator.focusout(domElement);
    eventSimulator.click(domElement);
    eventSimulator.dblclick(domElement);
    eventSimulator.mousedown(domElement);
    eventSimulator.mousemove(domElement);
    eventSimulator.mouseout(domElement);
    eventSimulator.mouseover(domElement);
    eventSimulator.mouseup(domElement);
    eventSimulator.beforeInput(domElement);
    eventSimulator.input(domElement);
    eventSimulator.keydown(domElement);
    eventSimulator.keyup(domElement);

    deepEqual(log, expectedLog);
});

if (nativeMethods.WindowInputEvent) {
    test('Simulated "input" event should contain the "data" property (GH-2377)', function () {
        var handler = function (e) {
            if (e.data === 'test')
                raised = true;
        };

        var eventName = 'input';

        document.addEventListener(eventName, handler);
        eventSimulator.input(domElement, 'test');
        document.removeEventListener(eventName, handler);

        ok(raised);
    });
}
