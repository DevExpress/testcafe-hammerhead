var Browser        = Hammerhead.get('./util/browser');
var EventSimulator = Hammerhead.get('./sandboxes/event/simulator');
var FocusBlur      = Hammerhead.get('./sandboxes/event/focus-blur');

var input1                             = null;
var input2                             = null;
var input1FocusHandlersExecutedAmount  = null;
var input2FocusHandlersExecutedAmount  = null;
var input1BlurHandlersExecutedAmount   = null;
var input2BlurHandlersExecutedAmount   = null;
var input1ChangeHandlersExecutedAmount = null;
var input2ChangeHandlersExecutedAmount = null;
var TEST_ELEMENT_CLASS                 = 'testElement';
var testStartDelay                     = 25;
var testEndDelay                       = 25;

var testTimeoutIds = [];

var enableLogging = false;

function setDoubleTimeout (callback, timeout) {
    if (!timeout)
        timeout = 0;
    window.setTimeout(function () {
        window.setTimeout(callback, timeout);
    }, 50);
}

function logMessage (text) {
    if (enableLogging)
        ok(true, (new Date()).getSeconds() + ':' + (new Date()).getMilliseconds().toString() + ' ' + text);
}

function startNext () {
    while (testTimeoutIds.length)
        clearTimeout(testTimeoutIds.pop());
    FocusBlur.focus($('body')[0], function () {
        removeTestElements();
        if (Browser.isIE)
            setDoubleTimeout(start, testEndDelay);
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

function clearExecutedHandlersCounter () {
    input1FocusHandlersExecutedAmount = input2FocusHandlersExecutedAmount = input1BlurHandlersExecutedAmount =
        input2BlurHandlersExecutedAmount = input1ChangeHandlersExecutedAmount = input2ChangeHandlersExecutedAmount = 0;
}

function testFocusing (numberOfHandlers, testCanceled, testCallback) {
    var input1FocusedCount = 0;
    var input1BlurredCount = 0;
    var input2FocusedCount = 0;
    var input2BlurredCount = 0;

    var focus = function (element, callback) {
        if (testCanceled())
            return;

        if (element === input1) {
            input2BlurredCount += numberOfHandlers;
            input1FocusedCount += numberOfHandlers;
        }
        else if (element === input2) {
            input1BlurredCount += numberOfHandlers;
            input2FocusedCount += numberOfHandlers;
        }

        logMessage(' before focusing ' + element.id);
        FocusBlur.focus(element, function () {
            logMessage(' focus function callback called for ' + element.id);
            callback();
        });
    };

    var assertFocusing = function (element, callback) {
        if (testCanceled())
            return;

        strictEqual(document.activeElement, element, 'document.ActiveElement checked');
        strictEqual(input1FocusHandlersExecutedAmount, input1FocusedCount, 'input1FocusHandlersExecutedAmount checked');
        strictEqual(input2FocusHandlersExecutedAmount, input2FocusedCount, 'input2FocusHandlersExecutedAmount checked');
        strictEqual(input1BlurHandlersExecutedAmount, input1BlurredCount, 'input1BlurHandlersExecutedAmount checked');
        strictEqual(input2BlurHandlersExecutedAmount, input2BlurredCount, 'input2BlurHandlersExecutedAmount checked');
        callback();
    };

    async.series({
            firstInput1Focus: function (callback) {
                focus(input1, callback);
            },

            assertFirstInput1Focus: function (callback) {
                clearExecutedHandlersCounter();
                input1FocusedCount = input1BlurredCount = input2FocusedCount = input2BlurredCount = 0;
                assertFocusing(input1, callback);
            },

            firstInput2Focus: function (callback) {
                focus(input2, callback);
            },

            assertFirstInput2Focus: function (callback) {
                assertFocusing(input2, callback);
            },

            secondInput1Focus: function (callback) {
                focus(input1, callback);
            },

            assertSecondInput1Focus: function (callback) {
                assertFocusing(input1, callback);
            },

            secondInput2Focus: function (callback) {
                focus(input2, callback);
            },

            assertSecondInput2Focus: function (callback) {
                assertFocusing(input2, callback);
            },

            thirdInput1Focus: function (callback) {
                focus(input1, callback);
            },

            assertThirdInput1Focus: function (callback) {
                assertFocusing(input1, callback);
            },

            thirdInput2Focus: function (callback) {
                focus(input2, callback);
            },

            assertThirdInput2Focus: function (callback) {
                assertFocusing(input2, callback);
            },

            actionCallback: function () {
                if (testCanceled()) return;
                testCallback();
            }
        }
    );
}

function testChanging (numberOfHandlers, testCanceled, testCallback) {
    var input1ChangedCount = 0;
    var input2ChangedCount = 0;

    var assertChanging = function () {
        strictEqual(input1ChangeHandlersExecutedAmount, input1ChangedCount, 'input1ChangeHandlersExecutedAmount checked');
        strictEqual(input2ChangeHandlersExecutedAmount, input2ChangedCount, 'input2ChangeHandlersExecutedAmount checked');
    };

    var focusAndType = function (element, callback) {
        if (testCanceled())
            return;

        FocusBlur.focus(element, function () {
            assertChanging();
            if (element === input1)
                input1ChangedCount += numberOfHandlers;
            else if (element === input2)
                input2ChangedCount += numberOfHandlers;

            element.value += 'a';
            callback();
        });
    };

    async.series({
            firstInput1Focus: function (callback) {
                clearExecutedHandlersCounter();
                focusAndType(input1, callback);
            },

            firstInput2Focus: function (callback) {
                focusAndType(input2, callback);
            },

            secondInput1Focus: function (callback) {
                focusAndType(input1, callback);
            },

            secondInput2Focus: function (callback) {
                focusAndType(input2, callback);
            },

            thirdInput1Focus: function (callback) {
                focusAndType(input1, callback);
            },

            thirdInput2Focus: function (callback) {
                focusAndType(input2, callback);
            },

            actionCallback: function () {
                if (testCanceled()) return;
                testCallback();
            }
        }
    );
}

function runAsyncTest (actions, timeout) {
    var testCanceled = null;

    window.setTimeout(function () {
        actions(function () {
            return testCanceled;
        });
    }, testStartDelay);

    testTimeoutIds.push(
        setTimeout(function () {
            testCanceled = true;
            ok(false, 'Timeout is exceeded');
            startNext();
        }, timeout)
    );
}

function removeTestElements () {
    $('.' + TEST_ELEMENT_CLASS).remove();
}

//tests
QUnit.testStart = function () {
    input1 = $('<input type="text" id="input1"/>').addClass(TEST_ELEMENT_CLASS).appendTo('body').get(0);
    input2 = $('<input type="text" id="input2"/>').addClass(TEST_ELEMENT_CLASS).appendTo('body').get(0);
    clearExecutedHandlersCounter();
};

QUnit.testDone = function () {
};

module('focus');

asyncTest('without handlers', function () {
    runAsyncTest(
        function (testCanceled) {
            testFocusing(0, testCanceled, startNext);
        },
        2000
    );
});

asyncTest('ontype handlers', function () {
    runAsyncTest(
        function (testCanceled) {
            var unbindHandlersAndTest = function () {
                input1.onfocus = null;
                input2.onfocus = null;
                input1.onblur  = null;
                input2.onblur  = null;
                testFocusing(0, testCanceled, startNext);
            };

            var bindHandlersAndTest = function () {
                input1.onfocus = onFocus;
                input2.onfocus = onFocus;
                input1.onblur  = onBlur;
                input2.onblur  = onBlur;
                testFocusing(1, testCanceled, unbindHandlersAndTest);
            };

            bindHandlersAndTest();
        },
        2000
    );
});

asyncTest('jQuery handlers one per element', function () {
    runAsyncTest(
        function (testCanceled) {
            var unbindHandlersAndTest = function () {
                var $input1 = $(input1);
                var $input2 = $(input2);

                $input1.unbind('focus', onFocus);
                $input2.unbind('focus', onFocus);
                $input1.unbind('blur', onBlur);
                $input2.unbind('blur', onBlur);
                testFocusing(0, testCanceled, startNext);
            };

            var bindHandlersAndTest = function () {
                var $input1 = $(input1);
                var $input2 = $(input2);

                $input1.focus(onFocus);
                $input2.focus(onFocus);
                $input1.blur(onBlur);
                $input2.blur(onBlur);
                testFocusing(1, testCanceled, unbindHandlersAndTest);
            };

            bindHandlersAndTest();
        },
        2000
    );
});

asyncTest('jQuery handlers three per element', function () {
    runAsyncTest(
        function (testCanceled) {
            var unbindHandlersAndTest = function () {
                var $input1 = $(input1);
                var $input2 = $(input2);

                $input1.unbind('focus', onFocus);
                $input2.unbind('focus', onFocus);
                $input1.unbind('blur', onBlur);
                $input2.unbind('blur', onBlur);
                testFocusing(0, testCanceled, startNext);
            };

            var bindHandlersAndTest = function () {
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
                testFocusing(3, testCanceled, unbindHandlersAndTest);
            };

            bindHandlersAndTest();
        },
        2000
    );
});

asyncTest('addEventListener one per element', function () {
    runAsyncTest(
        function (testCanceled) {
            if (input1.addEventListener) {
                var unbindHandlersAndTest = function () {
                    input1.removeEventListener('focus', onFocus, false);
                    input1.removeEventListener('blur', onBlur, false);
                    input2.removeEventListener('focus', onFocus, false);
                    input2.removeEventListener('blur', onBlur, false);
                    testFocusing(0, testCanceled, startNext);
                };

                var bindHandlersAndTest = function () {
                    input1.addEventListener('focus', onFocus, false);
                    input1.addEventListener('blur', onBlur, false);
                    input2.addEventListener('focus', onFocus, false);
                    input2.addEventListener('blur', onBlur, false);
                    testFocusing(1, testCanceled, unbindHandlersAndTest);
                };

                bindHandlersAndTest();
            }
            else startNext();
        },
        2000
    );
});

asyncTest('attachEvent one per element', function () {
    runAsyncTest(
        function (testCanceled) {
            if (input1.attachEvent) {
                var unbindHandlersAndTest = function () {
                    input1.detachEvent('onfocus', onFocus);
                    input1.detachEvent('onblur', onBlur);
                    input2.detachEvent('onfocus', onFocus);
                    input2.detachEvent('onblur', onBlur);
                    testFocusing(0, testCanceled, startNext);
                };

                var bindHandlersAndTest = function () {
                    input1.attachEvent('onfocus', onFocus);
                    input1.attachEvent('onblur', onBlur);
                    input2.attachEvent('onfocus', onFocus);
                    input2.attachEvent('onblur', onBlur);
                    testFocusing(1, testCanceled, unbindHandlersAndTest);
                };

                bindHandlersAndTest();
            }
            else {
                expect(0);
                startNext();
            }
        },
        2000
    );
});

asyncTest('handlers binded by ontype property, jQuery and addEventListener\\attachEvent together', function () {
    runAsyncTest(
        function (testCanceled) {
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
                testFocusing(0, testCanceled, startNext);
            };

            var bindHandlersAndTest = function () {
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
                testFocusing(listenerCount, testCanceled, unbindHandlersAndTest);
            };

            bindHandlersAndTest();
        },
        2000
    );
});

module('change');

asyncTest('ontype handlers', function () {
    runAsyncTest(
        function (testCanceled) {
            var unbindHandlersAndTest = function () {
                input1.onchange = null;
                input2.onchange = null;
                testChanging(0, testCanceled, startNext);
            };

            var bindHandlersAndTest = function () {
                input1.onchange = onChange;
                input2.onchange = onChange;
                testChanging(1, testCanceled, unbindHandlersAndTest);
            };

            bindHandlersAndTest();
        },
        2000
    );
});

asyncTest('jQuery handlers three per element', function () {
    runAsyncTest(
        function (testCanceled) {
            var unbindHandlersAndTest = function () {
                $(input1).unbind('change', onChange);
                $(input2).unbind('change', onChange);
                testChanging(0, testCanceled, startNext);
            };

            var bindHandlersAndTest = function () {
                var $input1 = $(input1);
                var $input2 = $(input2);

                $input1.change(onChange);
                $input2.change(onChange);
                $input1.change(onChange);
                $input2.change(onChange);
                $input1.change(onChange);
                $input2.change(onChange);
                testChanging(3, testCanceled, unbindHandlersAndTest);
            };

            bindHandlersAndTest();
        },
        2000
    );
});

asyncTest('handlers binded by ontype property, jQuery and addEventListener\\attachEvent together', function () {
    runAsyncTest(
        function (testCanceled) {
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
                testChanging(0, testCanceled, startNext);
            };

            var bindHandlersAndTest = function () {
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
                testChanging(listenerCount, testCanceled, unbindHandlersAndTest);
            };

            bindHandlersAndTest();
        },
        2000
    );
});

asyncTest('focus without handlers', function () {
    runAsyncTest(
        function () {
            input1.focus();

            var $input1 = $(input1);
            var $input2 = $(input2);

            var blured  = false;
            var focused = false;

            var onblur = function () {
                blured = true;
            };

            var onfocus    = function () {
                focused = true;
            };

            $input1.bind('blur', onblur);
            input1.onblur  = onblur;

            $input2.bind('focus', onfocus);
            input2.onfocus = onfocus;

            FocusBlur.focus(input2, function () {
                ok(!blured);
                ok(!focused);
                strictEqual(document.activeElement, input2);
                startNext();
            }, true);
        },
        2000
    );
});

asyncTest('blurring body with blur handler', function () {
    runAsyncTest(function () {
        var blurCount = 0;

        $('body').blur(function () {
            blurCount++;
        });
        FocusBlur.focus(document.body, function () {
            FocusBlur.focus(input1, function () {
                //body blur handler is raised only is IE
                strictEqual(blurCount, Browser.isIE ? 1 : 0, 'check amount of body blur handlers called');
                startNext();
            });
        });
    }, 2000);
});

module('native methods replacing');

asyncTest('focus() called by client script when browser window is on background', function () {
    runAsyncTest(
        function () {
            var focusCount = 0;

            input2.onfocus = function () {
                focusCount++;
            };
            input2.onclick = function () {
                input2.focus();
            };
            EventSimulator.click(input2);
            strictEqual(document.activeElement, input2);
            setDoubleTimeout(function () {
                strictEqual(focusCount, 1);
                startNext();
            });
        },
        2000
    );
});

asyncTest('blur() called by client script when browser window is on background', function () {
    runAsyncTest(
        function () {
            var blurCount = 0;

            input2.onblur  = function () {
                blurCount++;
            };
            input2.onclick = function () {
                input2.focus();
                input2.blur();
            };
            EventSimulator.click(input2);
            notEqual(document.activeElement, input2);
            setDoubleTimeout(function () {
                strictEqual(blurCount, 1);
                startNext();
            });
        },
        2000
    );
});

asyncTest('focus() must not raise event if element is already focused (B237541)', function () {
    runAsyncTest(
        function () {
            FocusBlur.focus(input2, function () {
                var focusCount = 0;

                input2.onfocus = function () {
                    focusCount++;
                };
                FocusBlur.focus(input2, function () {
                    input2.focus();
                    setDoubleTimeout(function () {
                        strictEqual(focusCount, 0);
                        strictEqual(document.activeElement, input2);
                        startNext();
                    });
                });
            });
        },
        2000
    );
});

asyncTest('blur() must not raise event if element is already blured', function () {
    runAsyncTest(
        function () {
            var blurCount = 0;

            input2.onblur = function () {
                blurCount++;
            };
            input2.blur();
            setDoubleTimeout(function () {
                FocusBlur.blur(input2, function () {
                    strictEqual(blurCount, 0);
                    notEqual(document.activeElement, input2);
                    startNext();
                });
            });
        },
        2000
    );
});

if (window.HTMLInputElement.prototype.setSelectionRange) {
    asyncTest('setSelectionRange() must raise focus in IE only', function () {
        runAsyncTest(
            function () {
                var needFocus   = Browser.isIE;
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
            },
            2000
        );
    });

    asyncTest('setSelectionRange() called by some event handler when browser window is on background', function () {
        runAsyncTest(
            function () {
                var needFocus  = Browser.isIE;
                var focusCount = 0;

                input2.onfocus = function () {
                    focusCount++;
                };
                input2.onclick = function () {
                    input2.value = 'text';
                    input2.setSelectionRange(1, 2);
                };

                EventSimulator.click(input2);
                setDoubleTimeout(function () {
                    strictEqual(focusCount, needFocus ? 1 : 0);
                    strictEqual(document.activeElement === input2, needFocus);

                    startNext();
                });
            },
            2000
        );
    });

    asyncTest('setSelectionRange() must not raise focus if element is already focused', function () {
        runAsyncTest(
            function () {
                FocusBlur.focus(input2, function () {
                    var focusCount = 0;

                    input2.onfocus = function () {
                        focusCount++;
                    };
                    input2.value   = 'text';
                    input2.setSelectionRange(1, 2);
                    setDoubleTimeout(function () {
                        strictEqual(focusCount, 0);
                        strictEqual(document.activeElement, input2);
                        startNext();
                    });
                });
            },
            2000
        );
    });
}

if (window.HTMLInputElement.prototype.createTextRange) {
    asyncTest('textRange.select() called by some event handler when browser window is on background', function () {
        runAsyncTest(
            function () {
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
                EventSimulator.click(input2);
                setDoubleTimeout(function () {
                    strictEqual(focusCount, 1);
                    strictEqual(document.activeElement, input2);
                    startNext();
                });
            },
            2000
        );
    });

    asyncTest('TextRange.select() must not raise focus if element is already focused (B237487)', function () {
        runAsyncTest(
            function () {
                FocusBlur.focus(input2, function () {
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
                    setDoubleTimeout(function () {
                        strictEqual(focusCount, 0);
                        strictEqual(document.activeElement, input2);
                        startNext();
                    });
                });
            },
            2000
        );
    });
}
