var nativeMethods = hammerhead.nativeMethods;

if (nativeMethods.performanceNow) {
    test('performanceNow', function () {
        var now = nativeMethods.performanceNow();

        ok(!isNaN(parseFloat(now)));
    });
}
