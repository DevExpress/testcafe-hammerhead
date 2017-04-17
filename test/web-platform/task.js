var id = window.setInterval(function () {
    if (document.getElementById('results')) {
        clearInterval(id);

        var reportRows = document.querySelectorAll('tr.pass, tr.fail');
        var result     = {
            test:   location.toString(),
            passed: [],
            failed: []
        };

        for (var i = 0; i < reportRows.length; i++) {
            var subTestInfo = {
                subTestName: reportRows[i].children[1].innerHTML,
                message:     reportRows[i].children[2].innerHTML
            };

            if (reportRows[i].className === 'pass')
                result.passed.push(subTestInfo);
            else
                result.failed.push(subTestInfo);
        }

        window['%hammerhead%'].transport.performRequest({
            cmd:  'testCompleted',
            data: result,
        }, function (nextUrl) {
            window.location = nextUrl;
        });
    }
}, 10);