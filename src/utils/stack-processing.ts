import { parseProxyUrl } from './url';

const STACK_FRAME_REG_EXPS = [
    /^\s*at .*\((\S+)\)/, // Chrome (with function name)
    /^\s*at (\S+)/, // Chrome (without function name)
    /^.*@(\S+)/, // Safari
    /(.+)/, // Any string
];

const STACK_FRAME_REGEX = /(?:^|\n)(?:\s*at |.*@)(?:.*\()?(\S+?):\d+:\d+\)?/g;

const ROW_COLUMN_NUMBER_REG_EX = /:\d+:\d+$/;

function getDestSource (source: string): string | null {
    const parsedProxiedUrl = parseProxyUrl(source);

    return parsedProxiedUrl && parsedProxiedUrl.destUrl;
}

function replaceUrlWithProxied (str: string, source: string): string {
    source = source.replace(ROW_COLUMN_NUMBER_REG_EX, '');

    const destUrl = getDestSource(source);

    return destUrl ? str.replace(source, destUrl) : str;
}

export function replaceProxiedUrlsInStack (stack: string): string {
    if (!stack)
        return stack;

    const stackFrames = stack.split('\n');

    for (let i = 0; i < stackFrames.length; i++) {
        const stackFrame = stackFrames[i];

        for (const stackFrameRegExp of STACK_FRAME_REG_EXPS) {
            if (stackFrameRegExp.test(stackFrame)) {
                stackFrames[i] = stackFrame.replace(stackFrameRegExp, replaceUrlWithProxied);

                break;
            }
        }
    }

    return stackFrames.join('\n');
}

export function getFirstDestUrl (stack: string | null | void): string | null {
    if (!stack)
        return null;

    let searchResult = STACK_FRAME_REGEX.exec(stack);

    while (searchResult) {
        const destUrl = getDestSource(searchResult[1]);

        if (destUrl) {
            STACK_FRAME_REGEX.lastIndex = 0;

            return destUrl;
        }

        searchResult = STACK_FRAME_REGEX.exec(stack);
    }

    return null;
}
