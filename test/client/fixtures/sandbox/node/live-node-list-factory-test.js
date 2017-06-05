/*eslint-disable no-unused-expressions*/
var TagCache = hammerhead.get('./sandbox/node/live-node-list/tag-cache');

var shadowUI      = hammerhead.sandbox.shadowUI;
var nativeMethods = hammerhead.nativeMethods;

var TEST_DIV_SELECTOR   = '#testDiv';
var TEST_CLASS_NAME     = 'test-class';
var TEST_CLASS_SELECTOR = '.test-class';

// NOTE: QUnit assertions (strictEqual, ok and etc.) uses the 'appendChild' method internally.
// 'appendChild' method call triggers update for a nodeList wrapper.
// This is why, we initially perform test actions and store tests results and then at end of test we call QUnit assertions.

QUnit.testStart(function () {
    if (!$(TEST_DIV_SELECTOR).length)
        $('<div id="testDiv">').appendTo('body');

    $(TEST_DIV_SELECTOR).empty();
    $(shadowUI.getRoot()).empty();
    $(TEST_CLASS_SELECTOR).remove();
});

module('getElementsByTagName', function () {
    test('TagCache', function () {
        var tagCache = new TagCache();

        tagCache.update('*');
        tagCache.update('div');
        tagCache.update('DIV');
        tagCache.update('TEXTarea');

        strictEqual(tagCache._cache.toString(), 'div,textarea');
        ok(tagCache.contains('div'));
        ok(tagCache.contains('DIV'));
        ok(tagCache.contains('TEXTAREA'));
    });

    test('wrong arguments', function () {
        var testCases    = [
            null,
            /*eslint-disable no-undefined*/
            undefined,
            /*eslint-enable no-undefined*/
            {},
            function () {
            }
        ];
        var result       = null;
        var nativeResult = null;

        testCases.forEach(function (testCase) {
            result       = document.getElementsByTagName(testCase);
            nativeResult = nativeMethods.getElementsByTagName.call(document, testCase);

            strictEqual(result.length, nativeResult.length);
        });
    });

    test('access by index, methods, instanceof', function () {
        var testDiv = document.querySelector(TEST_DIV_SELECTOR);
        var form1   = document.createElement('form');
        var form2   = document.createElement('form');
        var form3   = document.createElement('form');
        var root    = shadowUI.getRoot();

        form1.id = 'form1';
        form2.id = 'form2';
        form3.id = 'form3';

        testDiv.appendChild(form1);
        root.appendChild(form3);

        var elements           = document.body.getElementsByTagName('form');
        var nativeNodeListType = nativeMethods.getElementsByTagName.call(document, 'form').constructor;

        ok(elements instanceof nativeNodeListType);
        strictEqual(elements.length, 1);
        strictEqual(elements[0], form1);

        testDiv.appendChild(form2);
        strictEqual(elements.length, 2);
        strictEqual(elements[0], form1);
        strictEqual(elements[1], form2);
        strictEqual(elements.item(0), form1);
        strictEqual(elements.item(1), form2);

        if (elements.namedItem) {
            strictEqual(elements.namedItem(form1.id), form1);
            strictEqual(elements.namedItem(form3.id), null);
        }
    });

    module('performance', function () {
        var checkAssertions = function (assertions) {
            assertions.forEach(function (assertion) {
                ok(assertion.value, assertion.name);
            });
        };

        asyncTest('before DOMContentLoaded event is raised', function () {
            var iframe = document.createElement('iframe');

            iframe.id  = 'test_unique_id_' + Date.now();
            iframe.src = window.QUnitGlobals.getResourceUrl('../../../data/live-node-list/getElementsByTagName.html');
            window.QUnitGlobals.waitForIframe(iframe)
                .then(function () {
                    checkAssertions(iframe.contentWindow.assertions);

                    iframe.parentNode.removeChild(iframe);
                    start();
                });

            document.body.appendChild(iframe);
        });

        test('"*" tagName', function () {
            var testDiv    = document.querySelector(TEST_DIV_SELECTOR);
            var root       = shadowUI.getRoot();
            var textarea1  = document.createElement('textarea');
            var textarea2  = document.createElement('textarea');
            var textarea3  = document.createElement('textarea');
            var assertions = [];

            textarea1.id = 'textarea1';
            textarea2.id = 'textarea2';
            textarea3.id = 'textarea3';

            shadowUI.addClass(textarea3, 'el');
            testDiv.appendChild(textarea1);

            var elements             = document.getElementsByTagName('*');
            var refreshNodeListCount = 0;

            var descriptor              = Object.getOwnPropertyDescriptor(elements, '_refreshNodeListInternal');
            var storedDescriptorValueFn = descriptor.value;

            Object.defineProperty(elements, '_refreshNodeListInternal',
                {
                    value: function () {
                        refreshNodeListCount++;

                        return storedDescriptorValueFn.call(elements);
                    }
                });

            assertions.push(
                {
                    name:  'DOMContentLoaded event is raised',
                    value: elements._domContentLoadedEventRaised
                },
                {
                    name:  'first access after domContentLoading',
                    value: (function () {
                        elements[0];
                        elements[1];
                        elements[2];

                        return refreshNodeListCount === 0;
                    })()
                });

            testDiv.appendChild(textarea2);

            assertions.push(
                {
                    name:  'access after element was added',
                    value: (function () {
                        elements[0];

                        return refreshNodeListCount === 1;
                    })()
                },
                {
                    name:  'access when no changes',
                    value: (function () {
                        elements[0];

                        return refreshNodeListCount === 1;
                    })()
                });

            textarea2.parentNode.removeChild(textarea2);

            assertions.push(
                {
                    name:  'access after element was removed',
                    value: (function () {
                        elements[0];

                        return refreshNodeListCount === 2;
                    })()
                }, {
                    name:  'access when no changes',
                    value: (function () {
                        elements[0];

                        return refreshNodeListCount === 2;
                    })()
                });

            root.appendChild(textarea3);

            assertions.push({
                name:  'access after shadowUI element was added',
                value: (function () {
                    elements[0];

                    return refreshNodeListCount === 2;
                })()
            });

            setProperty(testDiv, 'innerHTML', '<div></div>');
            assertions.push(
                {
                    name:  "access after set element's innerHTML",
                    value: (function () {
                        elements[0];

                        return refreshNodeListCount === 3;
                    })()
                },
                {
                    name:  'for loop',
                    value: (function () {
                        for (var i = 0; i < elements.length; i++)
                            elements[i];

                        return refreshNodeListCount === 3;
                    })()
                });

            setProperty(root, 'innerHTML', '<div></div>');
            assertions.push({
                name:  "acsess after set shadowUI element's innerHTML",
                value: (function () {
                    elements[0];

                    return refreshNodeListCount === 3;
                })()
            });

            checkAssertions(assertions);
        });

        test('specified tagName', function () {
            var textarea1  = document.createElement('textarea');
            var input1     = document.createElement('input');
            var assertions = [];

            textarea1.id        = 'textarea1';
            input1.id           = 'input1';
            input1.className    = TEST_CLASS_NAME;
            textarea1.className = TEST_CLASS_NAME;

            var elements             = document.body.getElementsByTagName('textarea');
            var refreshNodeListCount = 0;

            var descriptor              = Object.getOwnPropertyDescriptor(elements, '_refreshNodeListInternal');
            var storedDescriptorValueFn = descriptor.value;

            Object.defineProperty(elements, '_refreshNodeListInternal',
                {
                    value: function () {
                        refreshNodeListCount++;

                        return storedDescriptorValueFn.call(elements);
                    }
                });

            assertions.push({
                name:  'first access after domContentLoading',
                value: (function () {
                    elements[0];
                    elements[1];
                    elements[2];

                    return refreshNodeListCount === 0;
                })()
            });

            document.body.appendChild(input1);

            assertions.push({
                name:  'non-tracking tagName',
                value: (function () {
                    elements[0];

                    return refreshNodeListCount === 0;
                })()
            });

            document.body.appendChild(textarea1);

            assertions.push({
                name:  'tracking tagName',
                value: (function () {
                    elements[0];

                    return refreshNodeListCount === 1;
                })()
            });

            checkAssertions(assertions);
        });

    });
});
