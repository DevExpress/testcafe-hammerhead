/*eslint-disable no-unused-expressions*/
var WrapperInternalInfo  = hammerhead.get('./sandbox/node/live-node-list/wrapper-internal-info');
var wrappersOutdatedInfo = hammerhead.get('./sandbox/node/live-node-list/wrappers-outdated-info');

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
    test('wrong arguments', function () {
        var testCases    = [
            null,
            void 0,
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
                strictEqual.apply(window, assertion);
            });
        };

        test('before DOMContentLoaded event is raised', function () {
            return createTestIframe({ src: getSameDomainPageUrl('../../../data/live-node-list/getElementsByTagName.html') })
                .then(function (iframe) {
                    checkAssertions(iframe.contentWindow.assertions);
                });
        });

        test('"*" tagName', function () {
            var storedRefreshNodeListFn = WrapperInternalInfo.default.prototype.refreshNodeList;
            var testDiv                 = document.querySelector(TEST_DIV_SELECTOR);
            var root                    = shadowUI.getRoot();
            var textarea1               = document.createElement('textarea');
            var textarea2               = document.createElement('textarea');
            var textarea3               = document.createElement('textarea');
            var assertions              = [];

            textarea1.id = 'textarea1';
            textarea2.id = 'textarea2';
            textarea3.id = 'textarea3';

            shadowUI.addClass(textarea3, 'el');
            testDiv.appendChild(textarea1);


            var elements             = document.getElementsByTagName('*');
            var refreshNodeListCount = 0;

            WrapperInternalInfo.default.prototype.refreshNodeList = function () {
                var storedFilteredNodeList = this.filteredNodeList;

                storedRefreshNodeListFn.apply(this, arguments);

                if (storedFilteredNodeList !== this.filteredNodeList)
                    refreshNodeListCount++;
            };

            assertions.push([wrappersOutdatedInfo._isDomContentLoaded, true, 'DOMContentLoaded event is raised']);

            elements[0];
            elements[1];
            elements[2];

            assertions.push([refreshNodeListCount, 0, 'first access after domContentLoading']);

            testDiv.appendChild(textarea2);

            elements[0];

            assertions.push([refreshNodeListCount, 1, 'access after element was added']);

            elements[0];

            assertions.push([refreshNodeListCount, 1, 'access when no changes']);

            textarea2.parentNode.removeChild(textarea2);

            elements[0];

            assertions.push([refreshNodeListCount, 2, 'access after element was removed']);

            elements[0];

            assertions.push([refreshNodeListCount, 2, 'access when no changes']);

            root.appendChild(textarea3);

            elements[0];

            assertions.push([refreshNodeListCount, 2, 'access after shadowUI element was added']);

            setProperty(testDiv, 'innerHTML', '<div></div>');

            elements[0];

            assertions.push([refreshNodeListCount, 3, "access after set element's innerHTML"]);

            for (var i = 0; i < elements.length; i++)
                elements[i];

            assertions.push([refreshNodeListCount, 3, 'for loop']);

            var newDiv = document.createElement('div');

            newDiv.id = 'newDiv';
            testDiv.replaceChild(newDiv, testDiv.firstChild);

            elements[0];

            assertions.push([refreshNodeListCount, 4, 'access after replaceChild']);

            checkAssertions(assertions);

            WrapperInternalInfo.default.prototype.refreshNodeList = storedRefreshNodeListFn;
        });

        test('specified tagName', function () {
            var storedRefreshNodeListFn = WrapperInternalInfo.default.prototype.refreshNodeList;
            var textarea1               = document.createElement('textarea');
            var input1                  = document.createElement('input');
            var assertions              = [];

            textarea1.id        = 'textarea1';
            input1.id           = 'input1';
            input1.className    = TEST_CLASS_NAME;
            textarea1.className = TEST_CLASS_NAME;

            var elements             = document.body.getElementsByTagName('textarea');
            var refreshNodeListCount = 0;

            WrapperInternalInfo.default.prototype.refreshNodeList = function () {
                var storedFilteredNodeList = this.filteredNodeList;

                storedRefreshNodeListFn.apply(this, arguments);

                if (storedFilteredNodeList !== this.filteredNodeList)
                    refreshNodeListCount++;
            };

            elements[0];
            elements[1];
            elements[2];

            assertions.push([refreshNodeListCount, 0, 'first access after domContentLoading']);

            document.body.appendChild(input1);

            elements[0];

            assertions.push([refreshNodeListCount, 0, 'non-tracking tagName']);

            document.body.appendChild(textarea1);

            elements[0];

            assertions.push([refreshNodeListCount, 1, 'tracking tagName']);

            document.body.replaceChild(input1, textarea1);

            elements[0];

            assertions.push([refreshNodeListCount, 2, 'replaceChild for tracking and non-tracking nodes']);

            checkAssertions(assertions);

            WrapperInternalInfo.default.prototype.refreshNodeList = storedRefreshNodeListFn;
        });
    });
});
