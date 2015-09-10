(function () {
    //NOTE: Prohibit Hammerhead from processing testing environment resources.
    // There are only testing environment resources on the page when this script is being executed. So, we can add
    // the hammerhead class to all script and link elements on the page.
    $('script').addClass('script-TC2b9a6d');
    $('link').addClass('ui-stylesheet-TC2b9a6d');


    var Settings = Hammerhead.get('./settings');

    Settings.set({
        sessionId: 'sessionId'
    });

    var UrlUtil     = Hammerhead.get('./utils/url');
    var JSProcessor = Hammerhead.get('../processing/js/index');
    var Const       = Hammerhead.get('../const');

    UrlUtil.OriginLocation.get = function () {
        return 'https://example.com';
    };

    window.initIFrameTestHandler = function (e) {
        if (e.iframe.id.indexOf('test') !== -1) {
            e.iframe.contentWindow.eval.call(e.iframe.contentWindow, [
                'Hammerhead.start({',
                '    referer : "http://localhost/sessionId/https://example.com",',
                '    serviceMsgUrl : "/service-msg/100",',
                '    sessionId : "sessionId"',
                '});'
            ].join(''));
        }
    };

    Hammerhead.start();

    window.overrideDomMeth = window[Const.DOM_SANDBOX_OVERRIDE_DOM_METHOD_NAME];

    window[Const.DOM_SANDBOX_OVERRIDE_DOM_METHOD_NAME] = function (el) {
        if (el)
            window.overrideDomMeth(el);
    };

    window.processScript = window[JSProcessor.PROCESS_SCRIPT_METH_NAME];
    window.getProperty   = window[JSProcessor.GET_PROPERTY_METH_NAME];
    window.setProperty   = window[JSProcessor.SET_PROPERTY_METH_NAME];
    window.callMethod    = window[JSProcessor.CALL_METHOD_METH_NAME];
    window.getLocation   = window[JSProcessor.GET_LOCATION_METH_NAME];


    var globals = window.QUnitGlobals;

    window.getCrossDomainPageUrl = function (filePath) {
        return window.QUnitGlobals.crossDomainHostname + globals.getResourceUrl(filePath);
    };
})();
