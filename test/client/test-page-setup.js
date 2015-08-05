window.TASK_UID_PROPERTY = '364dfb2b';

(function ($) {
    window.getCrossDomainPageUrl = function (page) {
        return location.protocol + '//' + location.hostname + ':1336/' + page;
    };

    var pageErrorMessage     = null;
    var done                 = false;
    var nativeXMLHttpRequest = window.XMLHttpRequest;

    window.addEventListener('error', function () {
        pageErrorMessage = $.browser.msie ? window.event.errorMessage : arguments[0].message;

        taskDone();
    });

    function taskDone (o) {
        if (!window[TASK_UID_PROPERTY] || done)
            return;

        done = true;

        var taskReport = null;

        if (pageErrorMessage) {
            taskReport = {
                failed:    1,
                passed:    1,
                total:     1,
                runtime:   1,
                errReport: {
                    report: [
                        {
                            testName: 'Window error on the page: ' + pageErrorMessage
                        }
                    ]
                }
            };
        }
        else {
            taskReport = {
                failed:    o.failed,
                passed:    o.passed,
                total:     o.total,
                runtime:   o.runtime,
                errReport: o.errReport
            };
        }

        window.XMLHttpRequest = nativeXMLHttpRequest;

        $.ajax({
            url:     '/run-next-test',
            type:    'POST',
            data:    {
                taskUid: window[TASK_UID_PROPERTY],
                report:  taskReport
            },
            success: function (data) {
                document.location = data + '?taskUid=' + window[TASK_UID_PROPERTY];
            }
        });
    }

    QUnit.done = function () {
        //NOTE: TestCafe changes in the vendor/qunit.css file. Show passed tests notification after tests done
        $('#qunit-tests .pass').css('display', 'inherit');

        taskDone.apply(this, arguments);
    };
})(jQuery);