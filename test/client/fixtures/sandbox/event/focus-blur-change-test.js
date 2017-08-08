var SHADOW_UI_CLASSNAME = hammerhead.get('./../shadow-ui/class-name');

var Promise             = hammerhead.Promise;
var browserUtils        = hammerhead.utils.browser;
var styleUtil           = hammerhead.utils.style;
var activeWindowTracker = hammerhead.sandbox.event.focusBlur.activeWindowTracker;
var eventSimulator      = hammerhead.sandbox.event.eventSimulator;
var focusBlur           = hammerhead.sandbox.event.focusBlur;
var nativeMethods       = hammerhead.nativeMethods;
var iframeSandbox       = hammerhead.sandbox.iframe;

var input1                            = null;
var input2                            = null;
var input1FocusHandlersExecutedCount  = 0;
var input2FocusHandlersExecutedCount  = 0;
var input1BlurHandlersExecutedCount   = 0;
var input2BlurHandlersExecutedCount   = 0;
var input1ChangeHandlersExecutedCount = 0;
var input2ChangeHandlersExecutedCount = 0;
var TEST_ELEMENT_CLASS                = 'testElement';
var testEndDelay                      = 25;

var enableLogging = false;

function setDoubleTimeout (timeout) {
    return new Promise(function (resolve) {
        if (!timeout)
            timeout = 0;
        window.setTimeout(function () {
            window.setTimeout(resolve, timeout);
        }, timeout);
    });
}

function logMessage (text) {
    if (enableLogging)
        ok(true, (new Date()).getSeconds() + ':' + (new Date()).getMilliseconds().toString() + ' ' + text);
}

function startNext () {
    focusBlur.focus(document.body, function () {
        removeTestElements();

        if (browserUtils.isIE)
            setDoubleTimeout(testEndDelay).then(start);
        else start();
    });
}

function getFocusHandler () {
    return function (e) {
        e = e || window.event;

        var element = e.target;

        if (element) {
            if (element.id === 'input1')
                input1FocusHandlersExecutedCount++;
            else if (element.id === 'input2')
                input2FocusHandlersExecutedCount++;
        }
        logMessage(' onfocus called for ' + element.id);
    };
}

function getBlurHandler () {
    return function (e) {
        e = e || window.event;

        var element = e.target;

        if (element) {
            if (element.id === 'input1')
                input1BlurHandlersExecutedCount++;
            else if (element.id === 'input2')
                input2BlurHandlersExecutedCount++;
        }
        logMessage(' onblur called for ' + element.id);
    };
}

function getChangeHandler () {
    return function (e) {
        e = e || window.event;

        var element = e.target;

        if (element) {
            if (element.id === 'input1')
                input1ChangeHandlersExecutedCount++;
            else if (element.id === 'input2')
                input2ChangeHandlersExecutedCount++;
        }
        logMessage(' onchange called for ' + element.id);
    };
}

var onFocus        = getFocusHandler();
var focusListener  = getFocusHandler();
var focusAttached  = getFocusHandler();
var onBlur         = getBlurHandler();
var blurListener   = getBlurHandler();
var blurAttached   = getBlurHandler();
var onChange       = getChangeHandler();
var changeListener = getChangeHandler();
var changeAttached = getChangeHandler();

var defaultTestTimeout         = QUnit.config.testTimeout;
var smallTestTimeout           = 3000;
var modulesForSmallTestTimeout = ['focus', 'change', 'native methods replacing'];

function clearExecutedHandlersCounter () {
    input1FocusHandlersExecutedCount = input2FocusHandlersExecutedCount = input1BlurHandlersExecutedCount =
        input2BlurHandlersExecutedCount = input1ChangeHandlersExecutedCount = input2ChangeHandlersExecutedCount = 0;
}

function testFocusing (numberOfHandlers, next) {
    var input1FocusedCount = 0;
    var input1BlurredCount = 0;
    var input2FocusedCount = 0;
    var input2BlurredCount = 0;

    var focus = function (el) {
        return new Promise(function (resolve) {
            if (el === input1) {
                input2BlurredCount += numberOfHandlers;
                input1FocusedCount += numberOfHandlers;
            }
            else if (el === input2) {
                input1BlurredCount += numberOfHandlers;
                input2FocusedCount += numberOfHandlers;
            }

            logMessage(' before focusing ' + el.id);
            focusBlur.focus(el, function () {
                logMessage(' focus function callback called for ' + el.id);
                resolve();
            });
        });
    };

    var assertFocusing = function (element) {
        strictEqual(document.activeElement, element, 'document.activeElement checked');
        strictEqual(input1FocusHandlersExecutedCount, input1FocusedCount, 'input1FocusHandlersExecutedAmount checked');
        strictEqual(input2FocusHandlersExecutedCount, input2FocusedCount, 'input2FocusHandlersExecutedAmount checked');
        strictEqual(input1BlurHandlersExecutedCount, input1BlurredCount, 'input1BlurHandlersExecutedAmount checked');
        strictEqual(input2BlurHandlersExecutedCount, input2BlurredCount, 'input2BlurHandlersExecutedAmount checked');
    };

    focus(input1)
        .then(function () {
            clearExecutedHandlersCounter();
            input1FocusedCount = input1BlurredCount = input2FocusedCount = input2BlurredCount = 0;

            assertFocusing(input1);
        })
        .then(function () {
            return focus(input2);
        })
        .then(function () {
            assertFocusing(input2);
        })
        .then(function () {
            return focus(input1);
        })
        .then(function () {
            assertFocusing(input1);
        })
        .then(function () {
            return focus(input2);
        })
        .then(function () {
            assertFocusing(input2);
        })
        .then(function () {
            return focus(input1);
        })
        .then(function () {
            assertFocusing(input1);
        })
        .then(function () {
            return focus(input2);
        })
        .then(function () {
            assertFocusing(input2);
            next();
        });
}

function testChanging (numberOfHandlers, next) {
    var input1ChangedCount = 0;
    var input2ChangedCount = 0;

    var assertChanging = function () {
        strictEqual(input1ChangeHandlersExecutedCount, input1ChangedCount, 'input1ChangeHandlersExecutedAmount checked');
        strictEqual(input2ChangeHandlersExecutedCount, input2ChangedCount, 'input2ChangeHandlersExecutedAmount checked');
    };

    var focusAndType = function (element) {
        return new Promise(function (resolve) {
            focusBlur.focus(element, function () {
                assertChanging();
                if (element === input1)
                    input1ChangedCount += numberOfHandlers;
                else if (element === input2)
                    input2ChangedCount += numberOfHandlers;

                element.value += 'a';
                resolve();
            });
        });
    };

    (function () {
        clearExecutedHandlersCounter();

        return focusAndType(input1);
    })()
        .then(function () {
            return focusAndType(input2);
        })
        .then(function () {
            return focusAndType(input1);
        })
        .then(function () {
            return focusAndType(input2);
        })
        .then(function () {
            return focusAndType(input1);
        })
        .then(function () {
            return focusAndType(input2);
        })
        .then(function () {
            next();
        });
}

function removeTestElements () {
    $('.' + TEST_ELEMENT_CLASS).remove();
}

QUnit.testStart(function (e) {
    input1 = $('<input type="text" id="input1"/>').addClass(TEST_ELEMENT_CLASS).appendTo('body').get(0);
    input2 = $('<input type="text" id="input2"/>').addClass(TEST_ELEMENT_CLASS).appendTo('body').get(0);
    clearExecutedHandlersCounter();

    if (modulesForSmallTestTimeout.indexOf(e.module) !== -1)
        QUnit.config.testTimeout = smallTestTimeout;

    iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT_EVENT, initIframeTestHandler);
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT_EVENT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    QUnit.config.testTimeout = defaultTestTimeout;

    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT_EVENT, initIframeTestHandler);
});

module('focus');

asyncTest('without handlers', function () {
    testFocusing(0, startNext);
});

asyncTest('ontype handlers', function () {
    var unbindHandlersAndTest = function () {
        input1.onfocus = null;
        input2.onfocus = null;
        input1.onblur  = null;
        input2.onblur  = null;
        testFocusing(0, startNext);
    };
    var bindHandlersAndTest   = function () {
        input1.onfocus = onFocus;
        input2.onfocus = onFocus;
        input1.onblur  = onBlur;
        input2.onblur  = onBlur;
        testFocusing(1, unbindHandlersAndTest);
    };

    bindHandlersAndTest();
});

asyncTest('jQuery handlers one per element', function () {
    var unbindHandlersAndTest = function () {
        var $input1 = $(input1);
        var $input2 = $(input2);

        $input1.unbind('focus', onFocus);
        $input2.unbind('focus', onFocus);
        $input1.unbind('blur', onBlur);
        $input2.unbind('blur', onBlur);
        testFocusing(0, startNext);
    };
    var bindHandlersAndTest   = function () {
        var $input1 = $(input1);
        var $input2 = $(input2);

        $input1.focus(onFocus);
        $input2.focus(onFocus);
        $input1.blur(onBlur);
        $input2.blur(onBlur);
        testFocusing(1, unbindHandlersAndTest);
    };

    bindHandlersAndTest();
});

asyncTest('jQuery handlers three per element', function () {
    var unbindHandlersAndTest = function () {
        var $input1 = $(input1);
        var $input2 = $(input2);

        $input1.unbind('focus', onFocus);
        $input2.unbind('focus', onFocus);
        $input1.unbind('blur', onBlur);
        $input2.unbind('blur', onBlur);
        testFocusing(0, startNext);
    };
    var bindHandlersAndTest   = function () {
        var $input1 = $(input1);
        var $input2 = $(input2);

        $input1.focus(onFocus);
        $input2.focus(onFocus);
        $input1.blur(onBlur);
        $input2.blur(onBlur);
        $input1.focus(onFocus);
        $input2.focus(onFocus);
        $input1.blur(onBlur);
        $input2.blur(onBlur);
        $input1.focus(onFocus);
        $input2.focus(onFocus);
        $input1.blur(onBlur);
        $input2.blur(onBlur);
        testFocusing(3, unbindHandlersAndTest);
    };

    bindHandlersAndTest();
});

asyncTest('addEventListener one per element', function () {
    var unbindHandlersAndTest = function () {
        input1.removeEventListener('focus', onFocus, false);
        input1.removeEventListener('blur', onBlur, false);
        input2.removeEventListener('focus', onFocus, false);
        input2.removeEventListener('blur', onBlur, false);
        testFocusing(0, startNext);
    };

    var bindHandlersAndTest = function () {
        input1.addEventListener('focus', onFocus, false);
        input1.addEventListener('blur', onBlur, false);
        input2.addEventListener('focus', onFocus, false);
        input2.addEventListener('blur', onBlur, false);
        testFocusing(1, unbindHandlersAndTest);
    };

    bindHandlersAndTest();
});

asyncTest('attachEvent one per element', function () {
    if (input1.attachEvent) {
        var unbindHandlersAndTest = function () {
            input1.detachEvent('onfocus', onFocus);
            input1.detachEvent('onblur', onBlur);
            input2.detachEvent('onfocus', onFocus);
            input2.detachEvent('onblur', onBlur);
            testFocusing(0, startNext);
        };

        var bindHandlersAndTest = function () {
            input1.attachEvent('onfocus', onFocus);
            input1.attachEvent('onblur', onBlur);
            input2.attachEvent('onfocus', onFocus);
            input2.attachEvent('onblur', onBlur);
            testFocusing(1, unbindHandlersAndTest);
        };

        bindHandlersAndTest();
    }
    else {
        expect(0);
        start();
    }
});

asyncTest('handlers binded by ontype property, jQuery and addEventListener\\attachEvent together', function () {
    var unbindHandlersAndTest = function () {
        var $input1 = $(input1);
        var $input2 = $(input2);

        $input1.unbind('focus', onFocus);
        $input2.unbind('focus', onFocus);
        $input1.unbind('blur', onBlur);
        $input2.unbind('blur', onBlur);
        input1.onfocus = null;
        input2.onfocus = null;
        input1.onblur  = null;
        input2.onblur  = null;
        if (input1.detachEvent) {
            input1.detachEvent('onfocus', focusAttached);
            input1.detachEvent('onblur', blurAttached);
            input2.detachEvent('onfocus', focusAttached);
            input2.detachEvent('onblur', blurAttached);
        }
        if (input1.removeEventListener) {
            input1.removeEventListener('focus', focusListener, false);
            input1.removeEventListener('blur', blurListener, false);
            input2.removeEventListener('focus', focusListener, false);
            input2.removeEventListener('blur', blurListener, false);
        }
        testFocusing(0, startNext);
    };
    var bindHandlersAndTest   = function () {
        var listenerCount = 0;
        var $input1       = $(input1);
        var $input2       = $(input2);

        $input1.focus(onFocus);
        $input2.focus(onFocus);
        $input1.blur(onBlur);
        $input2.blur(onBlur);
        listenerCount++;
        input1.onfocus = onFocus;
        input2.onfocus = onFocus;
        input1.onblur  = onBlur;
        input2.onblur  = onBlur;
        listenerCount++;
        if (input1.attachEvent) {
            input1.attachEvent('onfocus', focusAttached);
            input1.attachEvent('onblur', blurAttached);
            input2.attachEvent('onfocus', focusAttached);
            input2.attachEvent('onblur', blurAttached);
            listenerCount++;
        }
        if (input1.addEventListener) {
            input1.addEventListener('focus', focusListener, false);
            input1.addEventListener('blur', blurListener, false);
            input2.addEventListener('focus', focusListener, false);
            input2.addEventListener('blur', blurListener, false);
            listenerCount++;
        }
        testFocusing(listenerCount, unbindHandlersAndTest);
    };

    bindHandlersAndTest();
});

module('change');

asyncTest('ontype handlers', function () {
    var unbindHandlersAndTest = function () {
        input1.onchange = null;
        input2.onchange = null;
        testChanging(0, startNext);
    };

    var bindHandlersAndTest = function () {
        input1.onchange = onChange;
        input2.onchange = onChange;
        testChanging(1, unbindHandlersAndTest);
    };

    bindHandlersAndTest();
});

asyncTest('jQuery handlers three per element', function () {
    var unbindHandlersAndTest = function () {
        $(input1).unbind('change', onChange);
        $(input2).unbind('change', onChange);
        testChanging(0, startNext);
    };
    var bindHandlersAndTest   = function () {
        var $input1 = $(input1);
        var $input2 = $(input2);

        $input1.change(onChange);
        $input2.change(onChange);
        $input1.change(onChange);
        $input2.change(onChange);
        $input1.change(onChange);
        $input2.change(onChange);
        testChanging(3, unbindHandlersAndTest);
    };

    bindHandlersAndTest();
});

asyncTest('handlers binded by ontype property, jQuery and addEventListener\\attachEvent together', function () {
    var unbindHandlersAndTest = function () {
        var $input1 = $(input1);
        var $input2 = $(input2);

        $input1.unbind('change', onChange);
        $input2.unbind('change', onChange);
        input1.onchange = null;
        input2.onchange = null;
        if (input1.detachEvent) {
            input1.detachEvent('onchange', changeAttached);
            input2.detachEvent('onchange', changeAttached);
        }
        if (input1.removeEventListener) {
            input1.removeEventListener('change', changeListener, false);
            input2.removeEventListener('change', changeListener, false);
        }
        testChanging(0, startNext);
    };
    var bindHandlersAndTest   = function () {
        var listenerCount = 0;
        var $input1       = $(input1);
        var $input2       = $(input2);

        $input1.change(onChange);
        $input2.change(onChange);
        listenerCount++;
        input1.onchange = onChange;
        input2.onchange = onChange;
        listenerCount++;
        if (input1.attachEvent) {
            input1.attachEvent('onchange', changeAttached);
            input2.attachEvent('onchange', changeAttached);
            listenerCount++;
        }
        if (input1.addEventListener) {
            input1.addEventListener('change', changeListener, false);
            input2.addEventListener('change', changeListener, false);
            listenerCount++;
        }
        testChanging(listenerCount, unbindHandlersAndTest);
    };

    bindHandlersAndTest();
});

asyncTest('focus without handlers', function () {
    input1.focus();

    var $input1 = $(input1);
    var $input2 = $(input2);

    var blured  = false;
    var focused = false;

    var onblur  = function () {
        blured = true;
    };
    var onfocus = function () {
        focused = true;
    };

    $input1.bind('blur', onblur);
    input1.onblur = onblur;

    $input2.bind('focus', onfocus);
    input2.onfocus = onfocus;

    focusBlur.focus(input2, function () {
        ok(!blured);
        ok(!focused);
        strictEqual(document.activeElement, input2);
        startNext();
    }, true);
});

asyncTest('blurring body with blur handler', function () {
    var blurCount = 0;

    $('body').blur(function () {
        blurCount++;
    });

    focusBlur.focus(document.body, function () {
        focusBlur.focus(input1, function () {
            //body blur handler is raised only is IE
            strictEqual(blurCount, browserUtils.isIE ? 1 : 0, 'check amount of body blur handlers called');
            startNext();
        });
    });
});

module('native methods replacing');

asyncTest('focus() called by client script when browser window is on background', function () {
    var focusCount = 0;

    input2.onfocus = function () {
        focusCount++;
    };

    input2.onclick = function () {
        input2.focus();
    };

    eventSimulator.click(input2);
    strictEqual(document.activeElement, input2);
    setDoubleTimeout()
        .then(function () {
            strictEqual(focusCount, 1);
            startNext();
        });
});

asyncTest('blur() called by client script when browser window is on background', function () {
    var blurCount = 0;

    input2.onblur = function () {
        blurCount++;
    };

    input2.onclick = function () {
        input2.focus();
        input2.blur();
    };

    eventSimulator.click(input2);
    notEqual(document.activeElement, input2);
    setDoubleTimeout()
        .then(function () {
            strictEqual(blurCount, 1);
            startNext();
        });
});

asyncTest('focus() must not raise event if element is already focused (B237541)', function () {
    focusBlur.focus(input2, function () {
        var focusCount = 0;

        input2.onfocus = function () {
            focusCount++;
        };
        focusBlur.focus(input2, function () {
            input2.focus();
            setDoubleTimeout()
                .then(function () {
                    strictEqual(focusCount, 0);
                    strictEqual(document.activeElement, input2);
                    startNext();
                });
        });
    });
});

asyncTest('blur() must not raise event if element is already blured', function () {
    var blurCount = 0;

    input2.onblur = function () {
        blurCount++;
    };
    input2.blur();
    setDoubleTimeout()
        .then(function () {
            focusBlur.blur(input2, function () {
                strictEqual(blurCount, 0);
                notEqual(document.activeElement, input2);
                startNext();
            });
        });
});

if (window.HTMLInputElement.prototype.setSelectionRange) {
    asyncTest('focus after calling setSelectionRange()', function () {
        var needFocus   = browserUtils.isIE || browserUtils.isSafari;
        var focusRaised = false;
        var checkFocus  = function () {
            return focusRaised === needFocus;
        };

        input2.onfocus = function () {
            focusRaised = true;
        };

        input2.setSelectionRange(0, 0);

        window.QUnitGlobals.wait(checkFocus)
            .then(function () {
                strictEqual(document.activeElement === input2, needFocus);
                startNext();
            });
    });

    asyncTest('setSelectionRange() called by some event handler when the browser window is in background', function () {
        var needFocus  = browserUtils.isIE || browserUtils.isSafari;
        var focusCount = 0;

        input2.onfocus = function () {
            focusCount++;
        };
        input2.onclick = function () {
            input2.value = 'text';
            input2.setSelectionRange(1, 2);
        };

        eventSimulator.click(input2);
        setDoubleTimeout()
            .then(function () {
                strictEqual(focusCount, needFocus ? 1 : 0);
                strictEqual(document.activeElement === input2, needFocus);

                startNext();
            });
    });

    asyncTest('setSelectionRange() must not raise focus if element is already focused', function () {
        focusBlur.focus(input2, function () {
            var focusCount = 0;

            input2.onfocus = function () {
                focusCount++;
            };
            input2.value   = 'text';
            input2.setSelectionRange(1, 2);
            setDoubleTimeout()
                .then(function () {
                    strictEqual(focusCount, 0);
                    strictEqual(document.activeElement, input2);
                    startNext();
                });
        });
    });
}

if (window.HTMLInputElement.prototype.createTextRange) {
    asyncTest('textRange.select() called by some event handler when browser window is on background', function () {
        var focusCount = 0;

        input2.onfocus = function () {
            focusCount++;
        };
        input2.onclick = function () {
            input2.value = 'text';

            var textRange = input2.createTextRange();

            textRange.collapse(true);
            textRange.moveStart('character', 1);
            textRange.moveEnd('character', 2);
            textRange.select();
        };
        eventSimulator.click(input2);
        setDoubleTimeout()
            .then(function () {
                strictEqual(focusCount, 1);
                strictEqual(document.activeElement, input2);
                startNext();
            });
    });

    asyncTest('TextRange.select() must not raise focus if element is already focused (B237487)', function () {
        focusBlur.focus(input2, function () {
            var focusCount = 0;

            input2.onfocus = function () {
                focusCount++;
            };
            input2.value   = 'text';

            var textRange = input2.createTextRange();

            textRange.collapse(true);
            textRange.moveStart('character', 1);
            textRange.moveEnd('character', 2);
            textRange.select();
            setDoubleTimeout()
                .then(function () {
                    strictEqual(focusCount, 0);
                    strictEqual(document.activeElement, input2);
                    startNext();
                });
        });
    });
}

asyncTest('active window doesn\'t change after focusing ShadowUI element in iframe', function () {
    var src    = window.getSameDomainPageUrl('../../../data/active-window-tracker/active-window-tracker.html');

    return window.createTestIframe(src)
        .then(function (iframe) {
            var iframeWindow = iframe.contentWindow;
            var divElement   = iframeWindow.document.body.getElementsByTagName('div')[0];

            divElement.setAttribute('class', SHADOW_UI_CLASSNAME.postfix);

            focusBlur.focus(divElement, function () {
                window.QUnitGlobals
                    .wait(function () {
                        return activeWindowTracker.isCurrentWindowActive() &&
                               !iframeWindow.activeWindowTracker.isCurrentWindowActive();
                    })
                    .then(function () {
                        ok(activeWindowTracker.isCurrentWindowActive());
                        notOk(iframeWindow.activeWindowTracker.isCurrentWindowActive());

                        start();
                    });
            });
        });
});

asyncTest('check that scrolling does not happen when focus is set (after mouse events)', function () {
    var parentDiv = document.createElement('div');
    var childDiv  = document.createElement('div');

    $(parentDiv)
        .css({
            backgroundColor: 'grey',
            width:           '110%',
            height:          '500px',
            overflow:        'scroll',
            marginBottom:    '500px'

        })
        .attr('tabIndex', 1);

    // NOTE: We should use unfocusable element in IE. (T292365)
    $(childDiv)
        .css({
            marginLeft: '110%',
            marginTop:  '110%'
        })
        .attr('innerHTML', 'Child');

    parentDiv.appendChild(childDiv);
    document.body.appendChild(parentDiv);

    var divOffset = styleUtil.getOffset(parentDiv);

    styleUtil.setScrollLeft(window, divOffset.left + document.documentElement.clientWidth / 10);
    styleUtil.setScrollTop(window, divOffset.top + 250);

    parentDiv.scrollLeft = parentDiv.scrollWidth;
    parentDiv.scrollTop  = parentDiv.scrollHeight;

    var oldWindowScroll    = styleUtil.getElementScroll(window);
    var oldParentDivScroll = styleUtil.getElementScroll(parentDiv);

    focusBlur.focus(childDiv, function () {
        var currentWindowScroll    = styleUtil.getElementScroll(window);
        var currentParentDivScroll = styleUtil.getElementScroll(parentDiv);

        deepEqual(currentWindowScroll, oldWindowScroll);
        deepEqual(currentParentDivScroll, oldParentDivScroll);

        document.body.removeChild(parentDiv);
        start();
    }, false, true);
});

asyncTest("focus() must not scroll to the element if 'preventScrolling' argument is true", function () {
    var div = document.createElement('input');

    $(div)
        .css({
            backgroundColor: 'grey',
            width:           '500px',
            height:          '500px',
            top:             '2500px',
            position:        'absolute'
        })
        .attr('tabIndex', 1);

    document.body.appendChild(div);

    var oldWindowScroll = styleUtil.getElementScroll(window);

    focusBlur.focus(div, function () {
        var currentWindowScroll = styleUtil.getElementScroll(window);

        deepEqual(currentWindowScroll, oldWindowScroll);

        document.body.removeChild(div);
        start();
    }, false, true, false, true);
});

module('focusin/focusout');

asyncTest('events order', function () {
    var eventLog                       = '';
    var nativeEventLog                 = '';
    var input                          = document.createElement('input');
    var nativeInput                    = nativeMethods.createElement.call(document, 'input');
    var getNativeEventLogFallbackValue = function () {
        if (browserUtils.isMSEdge)
            return 'focus|focusin|focusout|blur';

        else if (browserUtils.isIE)
            return 'focusin|focusout|focus|blur|';

        return 'focus|focusin|blur|focusout|';
    };

    document.body.appendChild(input);
    nativeInput.focus = nativeMethods.focus;
    nativeInput.blur  = nativeMethods.blur;
    nativeMethods.appendChild.call(document.body, nativeInput);

    var handler                 = function (e) {
        eventLog += e.type + '|';
    };
    var handlerForNativeElement = function (e) {
        nativeEventLog += e.type + '|';
    };

    input.addEventListener('focus', handler);
    input.addEventListener('focusin', handler);
    input.addEventListener('blur', handler);
    input.addEventListener('focusout', handler);
    nativeInput.addEventListener('focus', handlerForNativeElement);
    nativeInput.addEventListener('focusin', handlerForNativeElement);
    nativeInput.addEventListener('blur', handlerForNativeElement);
    nativeInput.addEventListener('focusout', handlerForNativeElement);

    nativeInput.focus();
    nativeInput.blur();

    input.focus();
    input.blur();

    window.setTimeout(function () {
        // NOTE: if browser is not in focus then focus and blur events were not raised.
        // In this case, we provide the browser-specific fallback value
        strictEqual(eventLog, nativeEventLog || getNativeEventLogFallbackValue());

        input.parentNode.removeChild(input);
        nativeInput.parentNode.removeChild(nativeInput);
        start();
    }, 100);
});

test('label.htmlFor', function () {
    var label    = document.createElement('label');
    var input    = document.createElement('input');
    var eventLog = '';
    var handler  = function (e) {
        eventLog += e.target.id + '-' + e.type;
    };

    label.id = 'testLabel';
    input.id = 'testInput';

    label.addEventListener('focus', handler);
    input.addEventListener('focus', handler);

    document.body.appendChild(label);
    document.body.appendChild(input);

    var focusLabel = function () {
        return new Promise(function (resolve) {
            focusBlur.focus(label, resolve);
        });
    };

    label.htmlFor = 'testInput';

    return focusLabel()
        .then(function () {
            strictEqual(eventLog, 'testInput-focus');
            eventLog      = '';
            label.htmlFor = 'wrong';

            return focusLabel();
        })
        .then(function () {
            strictEqual(eventLog, '');

            label.parentNode.removeChild(label);
            input.parentNode.removeChild(input);
        });
});

module('regression');

test('querySelector must return active element even when browser is not focused (T285078)', function () {
    input1.focus();

    var result = eval(processScript('document.querySelectorAll(":focus")'));

    strictEqual(result.length, 1);
    strictEqual(result[0], input1);

    input1.blur();

    result = eval(processScript('document.querySelectorAll(":focus")'));

    if (browserUtils.isIE && !browserUtils.isMSEdge) {
        strictEqual(result.length, 1);
        strictEqual(result[0], document.body);
    }
    else
        strictEqual(result.length, 0);
});

asyncTest('error on the http://phonejs.devexpress.com/Demos/?url=KitchenSink&sm=3 page (B237723)', function () {
    var errorRaised = false;

    return window.createTestIframe(window.getSameDomainPageUrl('../../../data/event-sandbox/focus-blur-sandbox.html'))
        .then(function (iframe) {
            try {
                iframe.contentWindow.focusInput();
            }
            catch (e) {
                errorRaised = true;
            }

            ok(!errorRaised, 'error is not raised');
            startNext();
        });
});

asyncTest('scrolling elements with "overflow=hidden" should be restored after focus (GH-221)', function () {
    var parentDiv      = document.createElement('div');
    var childContainer = document.createElement('div');
    var childDiv       = document.createElement('div');

    $(parentDiv)
        .css({
            backgroundColor: 'grey',
            width:           '500px',
            height:          '150px',
            overflow:        'hidden'

        })
        .attr('id', 'parent');

    $(childContainer).css({
        width:    '140px',
        height:   '100px',
        position: 'relative',
        left:     '80%',
        overflow: 'hidden'
    });

    $(childDiv)
        .css({
            width:      '150px',
            height:     '100px',
            background: 'red'
        })
        .attr('id', 'child');

    childContainer.appendChild(childDiv);
    parentDiv.appendChild(childContainer);
    document.body.appendChild(parentDiv);

    var containerScroll = styleUtil.getElementScroll(childContainer);
    var parentScroll    = styleUtil.getElementScroll(parentDiv);

    focusBlur.focus(childDiv, function () {
        deepEqual(styleUtil.getElementScroll(childContainer), containerScroll);
        deepEqual(styleUtil.getElementScroll(parentDiv), parentScroll);

        document.body.removeChild(parentDiv);
        start();
    }, false, true);
});

test('focus() must not raise the event if the element is invisible (GH-442)', function () {
    var checkFocus = function (style) {
        return new Promise(function (resolve) {
            var styleProp         = Object.keys(style)[0];
            var isOverriddenFocus = false;
            var isCleanFocus      = false;

            var onInputFocus = function (e) {
                if (e.target.id === 'overridden')
                    isOverriddenFocus = true;
                else if (e.target.id === 'clean')
                    isCleanFocus = true;
            };

            input1.id               = 'overridden';
            input2.id               = 'clean';
            input1.style[styleProp] = style[styleProp];
            input2.style[styleProp] = style[styleProp];

            input1.addEventListener('focus', onInputFocus);
            nativeMethods.addEventListener.call(input2, 'focus', onInputFocus);

            input1.focus();
            nativeMethods.focus.call(input2);

            setTimeout(function () {
                strictEqual(isCleanFocus, isOverriddenFocus);
                resolve();
            }, 100);
        });
    };

    return checkFocus({ display: 'none' })
        .then(function () {
            return checkFocus({ visibility: 'hidden' });
        });
});

test('focus() must not raise the event if the element is in an invisible iframe (GH-442)', function () {
    var input  = document.createElement('input');
    var iframe = null;

    var checkFocus = function (shouldRiseFocus) {
        return new Promise(function (resolve) {
            var timeoutId = setTimeout(function () {
                input.removeEventListener('focus', focusHandler);
                ok(!shouldRiseFocus);
                resolve();
            }, 100);

            function focusHandler () {
                input.removeEventListener('focus', focusHandler);
                clearTimeout(timeoutId);
                ok(shouldRiseFocus);
                resolve();
            }

            input.addEventListener('focus', focusHandler);
            input.focus();
        });
    };

    return window.createTestIframe({ style: 'display: none' })
        .then(function (createdIframe) {
            iframe = createdIframe;

            iframe.contentDocument.body.appendChild(input);

            return checkFocus(browserUtils.isWebKit);
        })
        .then(function () {
            iframe.style.display    = '';
            iframe.style.visibility = 'hidden';

            return checkFocus(browserUtils.isWebKit);
        });
});

asyncTest('should correctly handle the case when document.activeElement is null or an empty object (GH-768)', function () {
    expect(1);

    var errorHandler = function () {
        ok(false, 'error is reproduced');
    };

    window.addEventListener('error', errorHandler);

    window.createTestIframe()
        .then(function (iframe) {
            var iframeDocument = iframe.contentDocument;
            var iframeWindow   = iframe.contentWindow;
            var div            = iframeDocument.createElement('div');
            var innerDiv       = iframeDocument.createElement('div');

            iframeWindow.addEventListener('focus', function () {
                iframe.parentNode.removeChild(iframe);
                window.removeEventListener('error', errorHandler);
                ok(true, 'focus handler is called');

                start();
            }, true);

            div.id            = 'div';
            innerDiv.id       = 'innerDiv';
            innerDiv.tabIndex = 0;
            div.appendChild(innerDiv);
            iframeDocument.body.appendChild(div);

            innerDiv.focus();
            div.innerHTML = '<span>Replaced</span>';
        });
});
