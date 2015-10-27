var SHADOW_UI_CLASSNAME = hammerhead.get('./../shadow-ui/class-name');
var Promise             = hammerhead.get('es6-promise').Promise;

var browserUtils        = hammerhead.utils.browser;
var styleUtil           = hammerhead.utils.style;
var activeWindowTracker = hammerhead.sandbox.event.focusBlur.activeWindowTracker;
var eventSimulator      = hammerhead.sandbox.event.eventSimulator;
var focusBlur           = hammerhead.sandbox.event.focusBlur;

var input1                             = null;
var input2                             = null;
var input1FocusHandlersExecutedAmount  = null;
var input2FocusHandlersExecutedAmount  = null;
var input1BlurHandlersExecutedAmount   = null;
var input2BlurHandlersExecutedAmount   = null;
var input1ChangeHandlersExecutedAmount = null;
var input2ChangeHandlersExecutedAmount = null;
var TEST_ELEMENT_CLASS                 = 'testElement';
var testEndDelay                       = 25;

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

        var element = e.target || e.srcElement;

        if (element) {
            if (element.id === 'input1')
                input1FocusHandlersExecutedAmount++;
            else if (element.id === 'input2')
                input2FocusHandlersExecutedAmount++;
        }
        logMessage(' onfocus called for ' + element.id);
    };
}

function getBlurHandler () {
    return function (e) {
        e = e || window.event;

        var element = e.target || e.srcElement;

        if (element) {
            if (element.id === 'input1')
                input1BlurHandlersExecutedAmount++;
            else if (element.id === 'input2')
                input2BlurHandlersExecutedAmount++;
        }
        logMessage(' onblur called for ' + element.id);
    };
}

function getChangeHandler () {
    return function (e) {
        e = e || window.event;

        var element = e.target || e.srcElement;

        if (element) {
            if (element.id === 'input1')
                input1ChangeHandlersExecutedAmount++;
            else if (element.id === 'input2')
                input2ChangeHandlersExecutedAmount++;
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
var smallTestTimeout           = 2000;
var modulesForSmallTestTimeout = ['focus', 'change', 'native methods replacing'];

function clearExecutedHandlersCounter () {
    input1FocusHandlersExecutedAmount = input2FocusHandlersExecutedAmount = input1BlurHandlersExecutedAmount =
        input2BlurHandlersExecutedAmount = input1ChangeHandlersExecutedAmount = input2ChangeHandlersExecutedAmount = 0;
}

function testFocusing (numberOfHandlers, startNext) {
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
        strictEqual(document.activeElement, element, 'document.ActiveElement checked');
        strictEqual(input1FocusHandlersExecutedAmount, input1FocusedCount, 'input1FocusHandlersExecutedAmount checked');
        strictEqual(input2FocusHandlersExecutedAmount, input2FocusedCount, 'input2FocusHandlersExecutedAmount checked');
        strictEqual(input1BlurHandlersExecutedAmount, input1BlurredCount, 'input1BlurHandlersExecutedAmount checked');
        strictEqual(input2BlurHandlersExecutedAmount, input2BlurredCount, 'input2BlurHandlersExecutedAmount checked');
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
            startNext();
        });
}

function testChanging (numberOfHandlers, startNext) {
    var input1ChangedCount = 0;
    var input2ChangedCount = 0;

    var assertChanging = function () {
        strictEqual(input1ChangeHandlersExecutedAmount, input1ChangedCount, 'input1ChangeHandlersExecutedAmount checked');
        strictEqual(input2ChangeHandlersExecutedAmount, input2ChangedCount, 'input2ChangeHandlersExecutedAmount checked');
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
            startNext();
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
});

QUnit.testDone(function () {
    QUnit.config.testTimeout = defaultTestTimeout;
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
        var $input1    = $(input1);
        var $input2    = $(input2);

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
        input1.onfocus    = onFocus;
        input2.onfocus    = onFocus;
        input1.onblur     = onBlur;
        input2.onblur     = onBlur;
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
        var $input1     = $(input1);
        var $input2     = $(input2);

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
        input1.onchange   = onChange;
        input2.onchange   = onChange;
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

    var onblur     = function () {
        blured = true;
    };
    var onfocus    = function () {
        focused = true;
    };

    $input1.bind('blur', onblur);
    input1.onblur  = onblur;

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

        input2.onfocus = function () {
            focusRaised = true;
        };

        input2.setSelectionRange(0, 0);

        window.setTimeout(function () {
            strictEqual(focusRaised, needFocus);
            strictEqual(document.activeElement === input2, needFocus);

            startNext();
        }, 200);
    });

    asyncTest('setSelectionRange() called by some event handler when browser window is on background', function () {
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
    var $iframe      = $('<iframe>');
    var iframeWindow = null;
    var divElement   = null;

    $iframe[0].src = window.QUnitGlobals.getResourceUrl('../../../data/active-window-tracker/active-window-tracker.html');
    $iframe.appendTo('body');

    $iframe.bind('load', function () {
        iframeWindow = this.contentWindow;
        divElement   = iframeWindow.document.body.getElementsByTagName('div')[0];
        divElement.setAttribute('class', SHADOW_UI_CLASSNAME.postfix);

        focusBlur.focus(divElement, function () {
            ok(activeWindowTracker.isCurrentWindowActive());
            notOk(iframeWindow.activeWindowTracker.isCurrentWindowActive());

            $iframe.remove();
            start();
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
    var iframeSrc = window.QUnitGlobals.getResourceUrl('../../../data/event-sandbox/focus-blur-sandbox.html');
    var $iframe   = $('<iframe>')
        .addClass(TEST_ELEMENT_CLASS)
        .attr('src', iframeSrc)
        .appendTo('body');

    var errorRaised = false;

    $iframe.load(function () {
        try {
            $iframe[0].contentWindow.focusInput();
        }
        catch (e) {
            errorRaised = true;
        }

        ok(!errorRaised, 'error is not raised');
        $iframe.remove();
        startNext();
    });
});
