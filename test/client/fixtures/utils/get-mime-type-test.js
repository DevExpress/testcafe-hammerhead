var getMimeType = hammerhead.utils.getMimeType;

test('png, jpeg, zip', function () {
    var testCases = [
        {
            mime: 'image/png',
            data: [137, 80, 78, 71, 13, 10, 26, 10, 0],
        },
        {
            mime: 'image/jpeg',
            data: [255, 216, 255, 224],
        },
        {
            mime: 'application/zip',
            data: [80, 75, 3, 4, 10, 0],
        },
    ];
    var mime      = null;

    testCases.forEach(function (testCase) {
        mime = getMimeType(testCase.data);

        strictEqual(mime, testCase.mime);
    });
});
