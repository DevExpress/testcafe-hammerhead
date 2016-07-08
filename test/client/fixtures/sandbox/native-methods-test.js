var nativeMethods = hammerhead.nativeMethods;

test('performanceNow', function () {
    if (!nativeMethods.performanceNow) {
        expect(0);
        return;
    }

    var now = nativeMethods.performanceNow();

    ok(!isNaN(parseFloat(now)));
});
