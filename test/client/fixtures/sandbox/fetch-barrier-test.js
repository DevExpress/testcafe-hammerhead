var FetchBarrier  = hammerhead.sandbox.fetchBarrier;
var fetchSandbox  = hammerhead.sandbox.fetch;
var iframeSandbox = hammerhead.sandbox.iframe;
var Promise       = hammerhead.Promise;
var nativeMethods = hammerhead.sandbox.nativeMethods;

QUnit.testStart(function () {
    iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);
});

if (window.fetch) {
    $(document).ready(function () {
        // Copy from https://github.com/DevExpress/testcafe/blob/master/src/client/core/utils/delay.js
        // Will be removed after moving to the testcafe
        function delay (ms) {
            return new Promise(function (resolve) {
                nativeMethods.setTimeout.call(window, resolve, ms);
            });
        }

        asyncTest('waitPageInitialRequests', function () {
            var completeReqCount       = 0;
            var reqCount               = 4;
            var barrierTimeoutExceeded = false;

            expect(1);

            var fetchBarrier = new FetchBarrier(fetchSandbox);

            for (var i = 0; i < reqCount; i++) {
                fetch('/xhr-test/200')
                    .then(function (response) {
                        return response.text();
                    })
                    .then(function () {
                        completeReqCount++;
                    });
            }

            // NOTE: ignore slow connection on the testing
            // farm that leads to unstable tests appearing
            delay(fetchBarrier.BARRIER_TIMEOUT)
                .then(function () {
                    barrierTimeoutExceeded = true;
                });

            fetchBarrier
                .wait(true)
                .then(function () {
                    ok(completeReqCount === reqCount || barrierTimeoutExceeded);
                    start();
                });
        });

        asyncTest('barrier - Wait requests complete', function () {
            var completeReqCount       = 0;
            var reqCount               = 2;
            var barrierTimeoutExceeded = false;

            expect(1);

            var fetchBarrier = new FetchBarrier(fetchSandbox);

            for (var i = 0; i < reqCount; i++) {
                fetch('/xhr-test/1000')
                    .then(function (response) {
                        return response.text();
                    }).then(function () {
                        completeReqCount++;
                    });
            }

            // NOTE: ignore slow connection on the testing
            // farm that leads to unstable tests appearing
            delay(fetchBarrier.BARRIER_TIMEOUT)
                .then(function () {
                    barrierTimeoutExceeded = true;
                });

            fetchBarrier
                .wait()
                .then(function () {
                    /*eslint-disable no-console*/
                    console.log('completeReqCount - ' + completeReqCount);
                    console.log('reqCount' + reqCount);
                    /*eslint-enable no-console*/
                    ok(completeReqCount === reqCount || barrierTimeoutExceeded);
                    start();
                });
        });

        asyncTest('timeout', function () {
            expect(1);

            var fetchBarrier   = new FetchBarrier(fetchSandbox);
            var reqIsCompleted = false;

            fetchBarrier.BARRIER_TIMEOUT = 0;

            fetch('/xhr-test/8000')
                .then(function (response) {
                    return response.text();
                })
                .then(function () {
                    reqIsCompleted = true;
                });

            fetchBarrier
                .wait()
                .then(function () {
                    ok(!reqIsCompleted);
                    start();
                });
        });

        asyncTest('should not wait pending requests', function () {
            var firstRequestCompleted  = false;
            var secondRequestCompleted = false;

            fetch('/xhr-test/3000')
                .then(function (response) {
                    return response.text();
                })
                .then(function () {
                    firstRequestCompleted = true;
                    start();
                });

            expect(2);

            var fetchBarrier = new FetchBarrier(fetchSandbox);

            window.setTimeout(function () {
                fetchBarrier
                    .wait()
                    .then(function () {
                        ok(!firstRequestCompleted);
                        ok(secondRequestCompleted);
                    });

                fetch('/xhr-test/200')
                    .then(function (response) {
                        return response.text();
                    })
                    .then(function () {
                        secondRequestCompleted = true;
                    });
            }, 100);
        });

        asyncTest('barrier - creating new iframe without src (B236650)', function () {
            var $iframe           = null;
            var windowErrorRaised = false;

            window.onerror = function () {
                windowErrorRaised = true;
            };

            var action = function (callback) {
                if ($iframe)
                    $iframe.remove();

                window.setTimeout(function () {
                    $iframe = $('<iframe id="test_unique_id_ydnvbfq2">').attr('src', 'about:blank').appendTo('body');
                }, 0);

                callback();
            };

            var fetchBarrier = new FetchBarrier(fetchSandbox);

            action.call(window, function () {
                fetchBarrier
                    .wait()
                    .then(function () {
                        ok(!windowErrorRaised);
                    });
            });

            window.setTimeout(function () {
                expect(1);
                $iframe.remove();
                start();
            }, 1000);
        });

        asyncTest('B237815 - Test runner - can\'t execute simple test', function () {
            var $iframe        = null;
            var callbackRaised = false;

            var action = function (callback) {
                $iframe = $('<iframe id="test_unique_id_kmgvu67">').appendTo('body');

                window.setTimeout(function () {
                    $iframe.remove();
                }, 50);

                callback();
            };

            var fetchBarrier = new FetchBarrier(fetchSandbox);

            action.call(window, function () {
                fetchBarrier
                    .wait()
                    .then(function () {
                        callbackRaised = true;
                    });
            });

            window.setTimeout(function () {
                ok(callbackRaised);
                start();
            }, 2000);
        });
    });
}

