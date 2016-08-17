var throttle = hammerhead.get('./utils/throttle');

asyncTest('basic', function () {
    var value    = 0;
    var setValue = function (newValue) {
        value = newValue;
    };
    var f1000    = throttle(setValue, 1000);

    // First run
    f1000(1);
    strictEqual(value, 1);

    // Ignored runs
    f1000(2);
    f1000(3);
    strictEqual(value, 1);


    // Last run
    f1000(4);
    window.setTimeout(function () {
        strictEqual(value, 4);

        start();
    }, 1000);
});
