var Browser         = Hammerhead.get('./util/browser');
var ScriptProcessor = Hammerhead.get('../processing/script');
var IFrameSandbox   = Hammerhead.get('./sandboxes/iframe');
var JSProcessor     = Hammerhead.get('../processing/js/index');
var NativeMethods   = Hammerhead.get('./sandboxes/native-methods');

QUnit.testStart = function () {
    // 'window.open' method uses in the QUnit
    window.open       = NativeMethods.windowOpen;
    window.setTimeout = NativeMethods.setTimeout;
    IFrameSandbox.on(IFrameSandbox.IFRAME_READY_TO_INIT, initIFrameTestHandler);
    IFrameSandbox.off(IFrameSandbox.IFRAME_READY_TO_INIT, IFrameSandbox.iframeReadyToInitHandler);
};

QUnit.testDone = function () {
    IFrameSandbox.off(IFrameSandbox.IFRAME_READY_TO_INIT, initIFrameTestHandler);
};

//T215136 - Not overrided all cases of "document.write" function (kakaku.com)
asyncTest('document.write in iframe', function () {
    expect(2);

    $('<iframe src="/data/dom-sandbox/iframe-with-doc-write.html">').appendTo('body').load(function () {
        var iframe = this;
        var div    = iframe.contentDocument.querySelector('#parent');

        strictEqual(div.children.length, 3);
        strictEqual(div.parentNode.lastElementChild, div);

        iframe.parentNode.removeChild(iframe);
        start();
    });
});

if (!Browser.isMozilla) {
    //T239131 - TD15.1 - error on image click (wikipedia.org)
    asyncTest('document.write([]) in iframe', function () {
        var iframe = document.createElement('iframe');

        iframe.id = 'test04';

        var loadHandler = function () {
            iframe.removeEventListener('load', loadHandler);

            // Some browsers remove they documentElement after "write([])" calling.
            // Previously, if the documentElement was null, "overrideDomMethods""
            // failed with the 'Maximum call stack size exceeded' error
            iframe.contentDocument.write([]);
            ok(true);
            iframe.contentDocument.close();
            iframe.parentNode.removeChild(iframe);
            start();
        };

        iframe.addEventListener('load', loadHandler);
        document.body.appendChild(iframe);
    });
}

//T190753 - A JavaScript error occurs during test running on msn.com
test('document.write for page html', function () {
    var $div            = $('<div>').appendTo('body');
    var $iframe         = $('<iframe id="test5">');
    var script          = 'var a = [1,2], b = 0; window.test = a[b];';
    var processedScript = ScriptProcessor.process(script).replace(/\s*/g, '');

    overrideDomMeth($div[0]);
    $div[0].appendChild($iframe[0]);

    ok(script.replace(/\s*/g, '') !== processedScript);

    $iframe[0].contentDocument.write('<html><head><script>' + script + '<\/script><head><body></body></html>');

    strictEqual($iframe[0].contentWindow.test, 1);

    var scripts = $iframe[0].contentDocument.getElementsByTagName('script');

    strictEqual(scripts.length, 1);
    strictEqual(scripts[0].text.replace(/\s*/g, ''), processedScript);

    $iframe.remove();
    $div.remove();
});

test('document.write for iframe.src with javascript protocol', function () {
    var $div = $('<div>').appendTo('body');

    overrideDomMeth($div[0]);

    var $iframe = $('<iframe id="test4" src="javascript:&quot;<html><body><a id=\'link\' href=\'http://google.com/\'></body></html>&quot;"></iframe>"');

    $div[0].appendChild($iframe[0]);
    ok($iframe[0].contentDocument.write.toString() !== NativeMethods.documentWrite.toString());

    $iframe.remove();
});

asyncTest('document.write for iframe with empty url', function () {
    var $div   = $('<div>').appendTo('body');
    var cheked = false;

    overrideDomMeth($div[0]);

    var $iframe = $('<iframe id="test3" src="about:blank">"');

    var check = function () {
        var document = $iframe[0].contentDocument;

        if (document)
            ok(document.write.toString() !== NativeMethods.documentWrite.toString());
    };

    check();

    $iframe.ready(check);
    $iframe.load(function () {
        check();

        var id = setInterval(function () {
            if (cheked) {
                clearInterval(id);
                $iframe.remove();
                start();
            }
        }, 10);

    });

    $div[0].appendChild($iframe[0]);
    check();
    cheked    = true;
});

if (!Browser.isMozilla) {
    test('override document after document.write calling', function () {
        var $div    = $('<div>').appendTo('body');
        var $sdiv   = $('<div>').appendTo('body');
        var $iframe = $('<iframe id="test11" src="about:blank">"');
        var iframe  = $iframe[0];

        var checkIframeDocumentOverrided = function () {
            var document = iframe.contentDocument;
            var result   = true;

            if (document) {
                if (document.write.toString() === NativeMethods.documentWrite.toString())
                    result = false;
            }

            // Stack overflow check
            ok(!document || document.getElementsByTagName('body'));
            ok(window.top.document.getElementsByTagName('body'));

            ok(result);
        };

        var checkWriteFunction = function () {
            checkIframeDocumentOverrided();
            iframe.contentDocument.open();
            checkIframeDocumentOverrided();
            iframe.contentDocument.write('<div></div>');
            checkIframeDocumentOverrided();
            iframe.contentDocument.close();
            checkIframeDocumentOverrided();

            iframe.contentDocument.open();
            checkIframeDocumentOverrided();
            iframe.contentDocument.write('<html><body><a href="http://google.com/"></body></html>');
            checkIframeDocumentOverrided();
            iframe.contentDocument.close();
            checkIframeDocumentOverrided();
        };

        $iframe.ready(checkIframeDocumentOverrided);
        $iframe.load(checkIframeDocumentOverrided);

        // After append to DOM
        $div[0].appendChild(iframe);
        checkWriteFunction();

        // After reinsert to dom
        $sdiv[0].appendChild(iframe);
        checkWriteFunction();

        $iframe.remove();
        $sdiv.remove();
        $div.remove();
    });
}

if (Browser.isMozilla || Browser.isIE11) {
    //T239109 - TD 15.1 - Hummerhead script error after perform search on http://livejournal.com page
    asyncTest('override window methods after document.write', function () {
        var $iframe = $('<iframe id="test_wrapper">');

        window.top.onIframeInited = function (window) {
            var iframeSandbox = window.Hammerhead.get('./sandboxes/iframe');

            iframeSandbox.on(iframeSandbox.IFRAME_READY_TO_INIT, initIFrameTestHandler);
            iframeSandbox.off(iframeSandbox.IFRAME_READY_TO_INIT, iframeSandbox.iframeReadyToInitHandler);
        };

        $iframe[0].setAttribute('src', 'javascript:\'' +
                                       '   <html><body><script>' +
                                       '       window.top.onIframeInited(window);' +
                                       '       var quote = String.fromCharCode(34);' +
                                       '       if(true){document.write("<iframe id=" + quote + "test_iframe" + quote + "></iframe>");}' +
                                       '       if(true){document.getElementById("test_iframe").contentDocument.write("<body><script>document.body.innerHTML = " + quote + "<div></div>" + quote + ";</s" + "cript></body>");}' +
                                       '   </sc' + 'ript></body></html>' +
                                       '\'');

        $iframe.appendTo('body');

        var id = setInterval(function () {
            var testIframe = $iframe[0].contentDocument.getElementById('test_iframe');

            if (testIframe && testIframe.contentDocument.body.children[0].tagName.toLowerCase() === 'div') {
                clearInterval(id);
                ok(true);
                $iframe.remove();
                start();
            }
        }, 10);

    });
}

//T232454: TD15.1 - Error on loading page https://openui5.hana.ondemand.com/test-resources/sap/m/demokit/cart/index.html?responderOn=true
test('document.write __begin$, __end$ parameters', function () {
    var result = '';

    /* eslint-disable no-unused-vars */
    var notADocument = {
        write: function () {
            result += Array.prototype.slice.call(arguments).join('');
        },

        writeln: function () {
            result += Array.prototype.slice.call(arguments).join('');
        }
    };
    /* eslint-enable no-unused-vars */

    var processedScript = processScript(
        'if (true) {' +
        '   notADocument.write("w1", "w2", "w3");' +
        '   notADocument.writeln("wl1", "wl2", "wl3");' +
        '   notADocument.writeln();' +
        '   notADocument.write();' +
        '}'
    );

    eval(processedScript);

    ok(processedScript.indexOf(JSProcessor.DOCUMENT_WRITE_BEGIN_PARAM) !== -1 &&
       processedScript.indexOf(JSProcessor.DOCUMENT_WRITE_END_PARAM) !== -1);

    strictEqual(result, 'w1w2w3wl1wl2wl3');
});
