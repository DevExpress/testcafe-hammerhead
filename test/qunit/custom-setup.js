(function () {
    var Settings = Hammerhead.get('./settings');

    Settings.set({
        JOB_OWNER_TOKEN: 'ownerToken',
        JOB_UID:         'jobUid'
    });

    var UrlUtil     = Hammerhead.get('./util/url');
    var JSProcessor = Hammerhead.get('../processing/js/index');
    var Const       = Hammerhead.get('../const');

    UrlUtil.OriginLocation.get = function () {
        return 'https://example.com';
    };

    window.initIFrameTestHandler = function (e) {
        if (e.iframe.id.indexOf('test') !== -1) {
            e.iframe.contentWindow.eval.call(e.iframe.contentWindow, [
                'var Settings = Hammerhead.get(\'./settings\');',
                'Settings.set({',
                '    REFERER : "http://localhost/ownerToken!jobUid/https://example.com",',
                '    JOB_OWNER_TOKEN : "ownerToken",',
                '    SERVICE_MSG_URL : "/service-msg/100",',
                '    JOB_UID : "jobUid"',
                '});',
                'Hammerhead.init();'
            ].join(''));
        }
    };

    Hammerhead.init();

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
})();