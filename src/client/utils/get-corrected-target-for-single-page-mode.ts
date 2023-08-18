import settings from '../settings';
import isKeywordTarget from '../../utils/is-keyword-target';
import * as windowsStorage from '../sandbox/windows-storage';

export default function (target = ''): string {
    if (settings.get().allowMultipleWindows)
        return target;

    if (target && !isKeywordTarget(target) && !windowsStorage.findByName(target) ||
        /_blank/i.test(target))
        return '_top';

    return target;
}
