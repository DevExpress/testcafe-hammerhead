const nativeMethods = typeof window === 'undefined' && typeof importScripts !== 'undefined'
    ? require('../worker/native-methods') : require('./native-methods');

export default nativeMethods;
