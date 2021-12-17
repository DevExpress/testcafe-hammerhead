(function () {
    // NOTE: Prevent Hammerhead from processing testing environment resources. There are only testing environment
    // resources on the page when this script is being executed. So, we can add the hammerhead class to all scripts
    // and link elements on the page.
    $('script').addClass('script-hammerhead-shadow-ui');
    $('link').addClass('ui-stylesheet-hammerhead-shadow-ui');

    var hammerhead    = window['%hammerhead%'];
    var nativeMethods = hammerhead.nativeMethods;

    nativeMethods.winLocalStorageGetter.call(window).clear();
    nativeMethods.winSessionStorageGetter.call(window).clear();

    var INTERNAL_PROPS = hammerhead.PROCESSING_INSTRUCTIONS.dom.internal_props;
    var INSTRUCTION    = hammerhead.PROCESSING_INSTRUCTIONS.dom.script;
    var destLocation   = hammerhead.utils.destLocation;
    var iframeSandbox  = hammerhead.sandbox.iframe;
    var cookieSandbox  = hammerhead.sandbox.cookie;

    destLocation.forceLocation('http://localhost/sessionId/https://example.com/');

    window.wait = function (timeout) {
        return new hammerhead.Promise(function (resolve) {
            setTimeout(resolve, timeout);
        });
    };

    var iframeTaskScriptTemplate = [
        'window["%hammerhead%"].utils.destLocation.forceLocation("{{{location}}}");',
        'window["%hammerhead%"].start({',
        '    referer : {{{referer}}},',
        '    cookie: {{{cookie}}},',
        '    serviceMsgUrl : "{{{serviceMsgUrl}}}",',
        '    transportWorkerUrl: "{{{transportWorkerUrl}}}",',
        '    workerHammerheadUrl: "{{{workerHammerheadUrl}}}",',
        '    sessionId : "sessionId",',
        '    forceProxySrcForImage: ' + 'false,',
        '    iframeTaskScriptTemplate: {{{iframeTaskScriptTemplate}}}',
        '});'
    ].join('');

    window.getIframeTaskScript = function (referer, serviceMsgUrl, location, cookie, transportWorkerUrl, workerHammerheadUrl) {
        return iframeTaskScriptTemplate
            .replace('{{{referer}}}', JSON.stringify(referer || ''))
            .replace('{{{serviceMsgUrl}}}', serviceMsgUrl || '')
            .replace('{{{location}}}', location || '')
            .replace('{{{cookie}}}', JSON.stringify(cookie || ''))
            .replace('{{{transportWorkerUrl}}}', transportWorkerUrl || '')
            .replace('{{{workerHammerheadUrl}}}', workerHammerheadUrl || '');
    };

    window.initIframeTestHandler = function (iframe) {
        var referer             = 'http://localhost/sessionId/https://example.com';
        var location            = 'http://localhost/sessionId/https://example.com';
        var serviceMsgUrl       = '/service-msg/100';
        var transportWorkerUrl  = '/transport-worker.js';
        var workerHammerheadUrl = '/worker-hammerhead.js';
        var cookie              = cookieSandbox.getCookie();
        var iframeTaskScript    = JSON.stringify(window.getIframeTaskScript(referer, serviceMsgUrl, location, cookie, transportWorkerUrl, workerHammerheadUrl));

        if (iframe.id.indexOf('test') !== -1) {
            iframe.contentWindow.eval.call(iframe.contentWindow, [
                'window["%hammerhead%"].utils.destLocation.forceLocation("' + location + '");',
                'window["%hammerhead%"].start({',
                '    referer: ' + JSON.stringify(referer) + ',',
                '    serviceMsgUrl: "' + serviceMsgUrl + '",',
                '    transportWorkerUrl: "' + transportWorkerUrl + '",',
                '    workerHammerheadUrl: "' + workerHammerheadUrl + '",',
                '    sessionId: "sessionId",',
                '    cookie: ' + JSON.stringify(cookie) + ',',
                '    forceProxySrcForImage: ' + 'false,',
                '    iframeTaskScriptTemplate: ' + iframeTaskScript + '',
                '});'
            ].join(''));
        }
    };

    hammerhead.start({
        sessionId:             'sessionId',
        cookie:                '',
        crossDomainProxyPort:  2001,
        forceProxySrcForImage: false,
        transportWorkerUrl:    '/transport-worker.js',
        workerHammerheadUrl:   '/worker-hammerhead.js',
        serviceMsgUrl:         '/service-msg'
    });

    window.processDomMeth = window[INTERNAL_PROPS.processDomMethodName];

    window[INTERNAL_PROPS.processDomMethodName] = function (el) {
        if (el)
            window.processDomMeth(el);
    };

    window.processScript = window[INSTRUCTION.processScript];
    window.getProperty   = window[INSTRUCTION.getProperty];
    window.setProperty   = window[INSTRUCTION.setProperty];
    window.callMethod    = window[INSTRUCTION.callMethod];
    window.getLocation   = window[INSTRUCTION.getLocation];
    window.getEval       = window[INSTRUCTION.getEval];
    window.hammerhead    = hammerhead;

    window.getCrossDomainPageUrl = function (filePath, resourceName) {
        return window.QUnitGlobals.crossDomainHostname + window.QUnitGlobals.getResourceUrl(filePath, resourceName);
    };

    window.getSameDomainPageUrl = function (filePath, resourceName) {
        return window.QUnitGlobals.hostname + window.QUnitGlobals.getResourceUrl(filePath, resourceName);
    };

    window.removeDoubleQuotes = function (str) {
        return str.replace(/"/g, '');
    };

    var MAX_ARG_COUNT = 3;

    var checkNativeFunctionCalling = function (methodName, nativeMethodName, owner, args) {
        var storedNative = nativeMethods[nativeMethodName];
        var passed       = true;
        var nativeCalled = false;

        if (nativeMethods[nativeMethodName] === owner[methodName])
            return false;

        nativeMethods[nativeMethodName] = function () {
            nativeMethods[nativeMethodName] = storedNative;

            if (arguments.length !== args.length)
                passed = false;

            for (var i = 0; i < args.length; i++) {
                if (typeof arguments[i] !== typeof args[i])
                    passed = false;
            }

            nativeCalled = true;
        };

        try {
            owner[methodName].apply(owner, args);
        }
        // eslint-disable-next-line no-empty
        catch (e) {
        }

        return nativeCalled && passed;
    };

    window.checkNativeFunctionArgs = function (methodName, nativeMethodName, owner) {
        var args              = [];
        var passed            = true;
        var possibleArgValues = [null, void 0, {}, [], '', true, 1, function () {
        }, document.createElement('div')];

        passed = passed && checkNativeFunctionCalling(methodName, nativeMethodName, owner, args);

        for (var i = 0; i < possibleArgValues.length * MAX_ARG_COUNT; i++) {
            var argIndex = i / possibleArgValues.length >> 0;

            if (args.length < argIndex)
                args.push(0);

            args[argIndex] = possibleArgValues[i % possibleArgValues.length];

            passed = passed && checkNativeFunctionCalling(methodName, nativeMethodName, owner, args);
        }

        ok(passed);
    };

    window.createTestIframe = function (attrs, parent) {
        var iframe = document.createElement('iframe');

        iframe.id = 'test' + Date.now();

        if (attrs) {
            Object.keys(attrs).forEach(function (attrName) {
                iframe.setAttribute(attrName, attrs[attrName]);
            });
        }

        parent = parent || document.body;

        QUnit.testDone(function () {
            // NOTE: For nested iframes we will delete only top iframe
            if (document.getElementById(iframe.id))
                iframe.parentNode.removeChild(iframe);
        });

        var promise = window.QUnitGlobals.waitForIframe(iframe);

        parent.appendChild(iframe);

        return promise
            .then(function () {
                return iframe;
            });
    };

    window.noop = function () {
    };

    window.checkStringRepresentation = function (wrappedFn, originalFn, fnName) {
        strictEqual(wrappedFn.toString(), originalFn.toString(),
            fnName + ': the outputs of the "toString()" method should be the same');
        strictEqual(Function.prototype.toString.call(wrappedFn), nativeMethods.functionToString.call(originalFn),
            fnName + ': the outputs of the "Function.prototype.toString" function should be the same');
        strictEqual(wrappedFn.name, originalFn.name, fnName + ': the function names should be the same');
    };

    window.waitForMessage = function (receiver) {
        return new hammerhead.Promise(function (resolve) {
            receiver.onmessage = function (e) {
                receiver.onmessage = void 0;

                resolve(e.data);
            };
        });
    };

    QUnitGlobals.WAIT_FOR_IFRAME_TIMEOUT = 20000;
    QUnit.config.testTimeout             = window.QUnitGlobals.WAIT_FOR_IFRAME_TIMEOUT * 2 + 5000;

    QUnit.moduleStart(function () {
        hammerhead.sandbox.node.raiseBodyCreatedEvent();
    });
    QUnit.testStart(function () {
        iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT_EVENT, window.initIframeTestHandler);
        iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT_EVENT, iframeSandbox.iframeReadyToInitHandler);
    });
    QUnit.testDone(function () {
        iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT_EVENT, window.initIframeTestHandler);
    });
})();
