test('call method of null or undefined', function () {
    var obj = void 0;

    throws(function () {
        callMethod(obj, 'yoyo');
    }, /Cannot call method 'yoyo' of undefined/);

    obj = null;

    throws(function () {
        callMethod(obj, 'yoyo');
    }, /Cannot call method 'yoyo' of null/);
});

test('calling not function', function () {
    var obj = {
        yo1: 123,
        yo2: null,
        yo3: 'hey ya',
    };

    throws(function () {
        callMethod(obj, 'yo1');
    }, /'yo1' is not a function/);

    throws(function () {
        callMethod(obj, 'yo2');
    }, /'yo2' is not a function/);

    throws(function () {
        callMethod(obj, 'yo3');
    }, /'yo3' is not a function/);
});

test('reading property of null or undefined', function () {
    var obj = void 0;

    throws(function () {
        getProperty(obj, 'yoyo');
    }, /Cannot read property 'yoyo' of undefined/);

    obj = null;

    throws(function () {
        getProperty(obj, 'yoyo');
    }, /Cannot read property 'yoyo' of null/);
});

test('setting property of null or undefined', function () {
    var obj = void 0;

    throws(function () {
        setProperty(obj, 'yoyo');
    }, /Cannot set property 'yoyo' of undefined/);

    obj = null;

    throws(function () {
        setProperty(obj, 'yoyo');
    }, /Cannot set property 'yoyo' of null/);
});
