var checkByCondition = hammerhead.get('./utils/check-by-condition');

var falsePredicate = function () {
    return false;
};

var truePredicate = function () {
    return true;
};

test('basic', function () {
    return checkByCondition(truePredicate)
        .then(function () {
            ok(true);
        })
        .catch(function () {
            ok(false, 'Should not reject');
        });
});

test('reject', function () {
    return checkByCondition(falsePredicate)
        .then(function () {
            ok(false, 'Should reject');
        })
        .catch(function () {
            ok(true);
        });
});

asyncTest('timeouts', function () {
    var setTimeFinished = false;

    setTimeout(function () {
        setTimeFinished = true;
    }, 900);

    checkByCondition(falsePredicate, { abortAfterMs: 1000 })
        .then(function () {
            ok(false, 'Should reject');
            start();
        })
        .catch(function () {
            ok(setTimeFinished);
            start();
        });
});
