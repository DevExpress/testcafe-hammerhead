/*eslint-disable no-unused-expressions*/
var DOMMutationTracker = hammerhead.sandboxUtils.domMutationTracker;

var shadowUI      = hammerhead.sandbox.shadowUI;
var nativeMethods = hammerhead.nativeMethods;
var browserUtils  = hammerhead.utils.browser;

var DOMMutationTrackerProto = Object.getPrototypeOf(DOMMutationTracker);

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
    var checkAssertions = function (assertions) {
        assertions.forEach(function (assertion) {
            strictEqual.apply(window, assertion);
        });
    };

    test('wrong arguments', function () {
        var testCases    = [
            null,
            void 0,
            {},
            '',
            function () {
            },
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

    test('for...in operator (GH-1376)', function () {
        var input1 = document.createElement('input');
        var input2 = document.createElement('input');
        var input3 = document.createElement('input');

        shadowUI.addClass(input3, 'el');

        document.body.appendChild(input1);
        document.body.appendChild(input2);
        document.body.appendChild(input3);

        var collection    = document.getElementsByTagName('input');
        var elementsCount = 0;
        var expectedProps = ['item', 'namedItem', 'length'];

        if (browserUtils.isMacPlatform && browserUtils.isSafari)
            expectedProps.push('constructor');

        for (var idx in collection) {
            if (collection.hasOwnProperty(idx))
                elementsCount++;
            else
                ok(expectedProps.indexOf(idx) !== -1);
        }

        strictEqual(elementsCount, 2);

        document.body.removeChild(input1);
        document.body.removeChild(input2);
        document.body.removeChild(input3);
    });

    test('named properties (GH-TC-2670)', function () {
        var metas           = document.getElementsByTagName('meta');
        var storedMetaCount = metas.length;
        var meta1           = document.createElement('meta');
        var meta2           = document.createElement('meta');
        var meta3           = document.createElement('meta');

        shadowUI.addClass(meta3, 'el');
        meta2.setAttribute('name', 'csrf-token');

        document.body.appendChild(meta1);
        document.body.appendChild(meta2);
        document.body.appendChild(meta3);

        strictEqual(metas.length, storedMetaCount + 2);
        strictEqual(metas['csrf-token'], meta2);

        meta2.setAttribute('name', '');
        meta1.setAttribute('name', 'csrf-token');

        strictEqual(metas.length, storedMetaCount + 2);
        strictEqual(metas['csrf-token'], meta1);

        document.body.removeChild(meta1);

        strictEqual(metas.length, storedMetaCount + 1);
        strictEqual(metas['csrf-token'], void 0);

        document.body.removeChild(meta2);
        document.body.removeChild(meta3);
    });

    test('should not create extra instances of HTMLCollectionWrapper', function () {
        var collectionWrapper = document.getElementsByTagName('*');

        strictEqual(collectionWrapper, document.getElementsByTagName('*'));

        document.body.appendChild(document.createElement('div'));

        strictEqual(collectionWrapper, document.getElementsByTagName('*'));
    });

    test('index properties of collection proto', function () {
        var assertions                  = [];
        var divCollection               = document.getElementsByTagName('div');
        var starCollection              = document.getElementsByTagName('*');
        var divCollectionLength         = divCollection.length;
        var starCollectionLength        = starCollection.length;
        var collectionProtoGettersCount = starCollectionLength + 10;

        assertions.push([collectionProtoGettersCount in starCollection, false]);
        assertions.push([collectionProtoGettersCount - 1 in starCollection, true]);
        assertions.push([collectionProtoGettersCount in divCollection, false]);
        assertions.push([collectionProtoGettersCount - 1 in divCollection, true]);

        document.body.appendChild(document.createElement('div'));
        document.body.appendChild(document.createElement('div'));

        assertions.push([divCollection.length, divCollectionLength + 2, true]);

        assertions.push([collectionProtoGettersCount in starCollection, false]);
        assertions.push([collectionProtoGettersCount - 1 in starCollection, true]);
        assertions.push([collectionProtoGettersCount in divCollection, false]);
        assertions.push([collectionProtoGettersCount - 1 in divCollection, true]);

        assertions.push([starCollection.length, starCollectionLength + 2, true]);

        assertions.push([collectionProtoGettersCount + 2 in starCollection, false]);
        assertions.push([collectionProtoGettersCount + 1 in starCollection, true]);
        assertions.push([collectionProtoGettersCount + 2 in divCollection, false]);
        assertions.push([collectionProtoGettersCount + 1 in divCollection, true]);

        checkAssertions(assertions);
    });

    module('performance', function () {
        test('before DOMContentLoaded event is raised', function () {
            return createTestIframe({ src: getSameDomainPageUrl('../../../data/live-node-list/getElementsByTagName.html') })
                .then(function (iframe) {
                    checkAssertions(iframe.contentWindow.assertions);
                });
        });

        test('"*" tagName', function () {
            var storedGetVersion = DOMMutationTrackerProto.getVersion;
            var testDiv          = document.querySelector(TEST_DIV_SELECTOR);
            var root             = shadowUI.getRoot();
            var textarea1        = document.createElement('textarea');
            var textarea2        = document.createElement('textarea');
            var textarea3        = document.createElement('textarea');
            var assertions       = [];

            textarea1.id = 'textarea1';
            textarea2.id = 'textarea2';
            textarea3.id = 'textarea3';

            shadowUI.addClass(textarea3, 'el');
            testDiv.appendChild(textarea1);

            var elements               = document.getElementsByTagName('*');
            var refreshCollectionCount = 0;

            DOMMutationTrackerProto.getVersion = function () {
                refreshCollectionCount++;

                return storedGetVersion.apply(this, arguments);
            };

            assertions.push([DOMMutationTracker._isDomContentLoaded, true, 'DOMContentLoaded event is raised']);

            elements[0];
            elements[1];
            elements[2];

            assertions.push([refreshCollectionCount, 0, 'first access after domContentLoading']);

            testDiv.appendChild(textarea2);

            elements[0];

            assertions.push([refreshCollectionCount, 1, 'access after element was added']);

            elements[0];

            assertions.push([refreshCollectionCount, 1, 'access when no changes']);

            testDiv.removeChild(textarea2);

            elements[0];

            assertions.push([refreshCollectionCount, 2, 'access after element was removed']);

            elements[0];

            assertions.push([refreshCollectionCount, 2, 'access when no changes']);

            root.appendChild(textarea3);

            elements[0];

            assertions.push([refreshCollectionCount, 2, 'access after shadowUI element was added']);

            testDiv.innerHTML = '<div></div>';

            elements[0];

            assertions.push([refreshCollectionCount, 3, 'access after set element\'s innerHTML']);

            testDiv.firstChild.outerHTML = '<span><b></b></span>';

            elements[0];

            assertions.push([refreshCollectionCount, 4, 'access after set element\'s outerHTML']);

            testDiv.firstChild.innerText = '123';

            elements[0];

            assertions.push([refreshCollectionCount, 5, 'access after set element\'s innerText']);

            for (var i = 0; i < elements.length; i++)
                elements[i];

            assertions.push([refreshCollectionCount, 5, 'for loop']);

            var newDiv = document.createElement('div');

            newDiv.id = 'newDiv';
            testDiv.replaceChild(newDiv, testDiv.firstChild);

            elements[0];

            assertions.push([refreshCollectionCount, 6, 'access after replaceChild']);

            testDiv.appendChild(document.createTextNode('text'));

            elements[0];

            assertions.push([refreshCollectionCount, 6, 'access after text node was added']);

            var fragment = document.createDocumentFragment();

            testDiv.appendChild(fragment);

            elements[0];

            assertions.push([refreshCollectionCount, 6, 'access after empty fragment was added']);

            fragment.appendChild(document.createElement('div'));

            elements[0];

            assertions.push([refreshCollectionCount, 6, 'access after div was added to fragment']);

            testDiv.appendChild(fragment);

            elements[0];

            assertions.push([refreshCollectionCount, 7, 'access after fragment with div was added']);

            var div = document.createElement('div');

            div.appendChild(document.createElement('span'));

            elements[0];

            assertions.push([refreshCollectionCount, 7, 'access after span was added to div which is not located in document']);

            checkAssertions(assertions);

            DOMMutationTrackerProto.getVersion = storedGetVersion;
        });

        test('specified tagName', function () {
            var storedGetVersion = DOMMutationTrackerProto.getVersion;
            var testDiv          = document.querySelector(TEST_DIV_SELECTOR);
            var textarea1        = document.createElement('textarea');
            var input1           = document.createElement('input');
            var assertions       = [];

            textarea1.id        = 'textarea1';
            input1.id           = 'input1';
            input1.className    = TEST_CLASS_NAME;
            textarea1.className = TEST_CLASS_NAME;

            var elements               = document.body.getElementsByTagName('textarea');
            var refreshCollectionCount = 0;

            DOMMutationTrackerProto.getVersion = function () {
                refreshCollectionCount++;

                return storedGetVersion.apply(this, arguments);
            };

            elements[0];
            elements[1];
            elements[2];

            assertions.push([refreshCollectionCount, 0, 'first access after domContentLoading']);

            document.body.appendChild(input1);

            elements[0];

            assertions.push([refreshCollectionCount, 0, 'non-tracking tagName']);

            document.body.appendChild(textarea1);

            elements[0];

            assertions.push([refreshCollectionCount, 1, 'tracking tagName']);

            document.body.replaceChild(input1, textarea1);

            elements[0];

            assertions.push([refreshCollectionCount, 2, 'replaceChild for tracking and non-tracking nodes']);

            testDiv.innerHTML = '<div><textarea></textarea></div>';

            elements[0];

            assertions.push([refreshCollectionCount, 3, 'access after set element\'s innerHTML']);

            testDiv.firstChild.innerText = 'text';

            elements[0];

            assertions.push([refreshCollectionCount, 4, 'access after set element\'s innerText']);

            testDiv.firstChild.outerHTML = '<div></div>';

            elements[0];

            assertions.push([refreshCollectionCount, 4, 'access after set element\'s outerHTML without textarea']);

            testDiv.firstChild.outerHTML = '<textarea></textarea>';

            elements[0];

            assertions.push([refreshCollectionCount, 5, 'access after set element\'s outerHTML with textarea']);

            var nativeDiv      = nativeMethods.createElement.call(document, 'div');
            var nativeTextArea = nativeMethods.createElement.call(document, 'textarea');

            nativeMethods.appendChild.call(nativeDiv, nativeTextArea);

            elements[0];

            assertions.push([refreshCollectionCount, 5, 'access when no changes']);

            testDiv.appendChild(nativeDiv);

            elements[0];

            assertions.push([refreshCollectionCount, 6, 'access after element was added with another element']);

            testDiv.removeChild(nativeDiv);

            elements[0];

            assertions.push([refreshCollectionCount, 7, 'access after element was removed with another element']);

            testDiv.insertAdjacentHTML('beforebegin', '<textarea></textarea>');

            elements[0];

            assertions.push([refreshCollectionCount, 8, 'access after element was added before begin text div']);

            testDiv.insertAdjacentHTML('afterbegin', '<textarea></textarea>');

            elements[0];

            assertions.push([refreshCollectionCount, 9, 'access after element was added after begin text div']);

            testDiv.insertAdjacentHTML('beforeend', '<textarea></textarea>');

            elements[0];

            assertions.push([refreshCollectionCount, 10, 'access after element was added before end text div']);

            testDiv.insertAdjacentHTML('afterend', '<textarea></textarea>');

            elements[0];

            assertions.push([refreshCollectionCount, 11, 'access after element was added after end text div']);

            checkAssertions(assertions);

            DOMMutationTrackerProto.getVersion = storedGetVersion;
        });

        test('getElementsByTagName("body") updates correctly GH-5322', function () {
            return createTestIframe({ src: getSameDomainPageUrl('../../../data/live-node-list/getBodyByTagName.html') })
                .then(function (iframe) {
                    ok(!iframe.contentWindow.bodyExistsBeforeAttachingBody);
                    ok(iframe.contentWindow.bodyExistsAfterAttachingBody);
                });
        });
    });
});
