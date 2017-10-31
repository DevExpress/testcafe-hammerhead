(function () {
    localStorage.clear();
    sessionStorage.clear();

    // NOTE: Prevent Hammerhead from processing testing environment resources. There are only testing environment
    // resources on the page when this script is being executed. So, we can add the hammerhead class to all scripts
    // and link elements on the page.
    $('script').addClass('script-hammerhead-shadow-ui');
    $('link').addClass('ui-stylesheet-hammerhead-shadow-ui');

    var hammerhead     = window['%hammerhead%'];
    var INTERNAL_PROPS = hammerhead.get('../processing/dom/internal-properties');
    var INSTRUCTION    = hammerhead.get('../processing/script/instruction');
    var destLocation   = hammerhead.get('./utils/destination-location');
    var settings       = hammerhead.get('./settings');
    var nativeMethods  = hammerhead.nativeMethods;

    destLocation.forceLocation('http://localhost/sessionId/https://example.com');

    var iframeTaskScriptTempate = [
        'window["%hammerhead%"].get("./utils/destination-location").forceLocation("{{{location}}}");',
        'window["%hammerhead%"].start({',
        '    referer : "{{{referer}}}",',
        '    cookie: {{{cookie}}},',
        '    serviceMsgUrl : "{{{serviceMsgUrl}}}",',
        '    cookieSyncUrl : "{{{cookieSyncUrl}}}",',
        '    sessionId : "sessionId",',
        '    iframeTaskScriptTemplate: {{{iframeTaskScriptTemplate}}}',
        '});'
    ].join('');

    window.getIframeTaskScript = function (referer, serviceMsgUrl, cookieSyncUrl, location, cookie) {
        return iframeTaskScriptTempate
            .replace('{{{referer}}}', referer || '')
            .replace('{{{serviceMsgUrl}}}', serviceMsgUrl || '')
            .replace('{{{cookieSyncUrl}}}', cookieSyncUrl)
            .replace('{{{location}}}', location || '')
            .replace('{{{cookie}}}', JSON.stringify(cookie || ''));
    };

    window.initIframeTestHandler = function (e) {
        var referer          = "http://localhost/sessionId/https://example.com";
        var location         = "http://localhost/sessionId/https://example.com";
        var serviceMsgUrl    = "/service-msg/100";
        var cookieSyncUrl    = "/cookie-sync/100";
        var cookie           = settings.get().cookie;
        var iframeTaskScript = JSON.stringify(window.getIframeTaskScript(referer, serviceMsgUrl, cookieSyncUrl, location, cookie));

        if (e.iframe.id.indexOf('test') !== -1) {
            e.iframe.contentWindow.eval.call(e.iframe.contentWindow, [
                'window["%hammerhead%"].get("./utils/destination-location").forceLocation("' + location + '");',
                'window["%hammerhead%"].start({',
                '    referer: "' + referer + '",',
                '    serviceMsgUrl: "' + serviceMsgUrl + '",',
                '    cookieSyncUrl: "' + cookieSyncUrl + '",',
                '    sessionId: "sessionId",',
                '    cookie: ' + JSON.stringify(cookie) + ',',
                '    iframeTaskScriptTemplate: ' + iframeTaskScript + '',
                '});'
            ].join(''));
        }
    };

    hammerhead.start({
        sessionId:            'sessionId',
        cookie:               '',
        cookieSyncUrl:        '/cookie-sync/100',
        crossDomainProxyPort: 2001
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
            /*eslint-disable no-empty */
        catch (e) {
        }
        /*eslint-enable no-empty */

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

    QUnitGlobals.WAIT_FOR_IFRAME_TIMEOUT = 20000;
    QUnit.config.testTimeout             = window.QUnitGlobals.WAIT_FOR_IFRAME_TIMEOUT * 2 + 5000;

    QUnit.moduleStart(function () {
        hammerhead.sandbox.node.raiseBodyCreatedEvent();
    });
})();
