import { isInputWithNativeDialog } from '../../utils/dom';
import { preventDefault } from '../../utils/event';
/*eslint-disable no-unused-vars*/
import Listeners from './listeners';
/*eslint-enable no-unused-vars*/

export default function (window: Window, listeners: Listeners): void {
    listeners.addInternalEventListener(window, ['click'], (e: Event, dispatched: boolean) => {
        if (dispatched && isInputWithNativeDialog(e.target as HTMLInputElement))
            preventDefault(e, true);
    });
}
