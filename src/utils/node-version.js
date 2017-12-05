export default (() => {
    let version;

    try {
        version = process.version
            .replace('v', '')
            .split('.', 2)
            .map(str => parseInt(str, 10));
    }
    catch (e) {
        version = [0, 0];
    }

    return { major: version[0], minor: version[1] };
})();
