import { Expression } from 'estree';
import { Syntax } from 'esotope-hammerhead';

const TEMP_VARIABLE_PREFIX = '_hh$temp';

export default class TempVariables {
    private static _counter = 0;
    private _list: string[] = [];

    static resetCounter () {
        TempVariables._counter = 0;
    }

    static generateName (baseName?: string, key?: Expression, index?: number): string {
        if (!baseName)
            return TEMP_VARIABLE_PREFIX + TempVariables._counter++;

        if (key) {
            if (key.type === Syntax.Identifier)
                return baseName + '$' + key.name;

            if (key.type === Syntax.Literal && key.value)
                return baseName + '$' + key.value.toString().replace(/[^a-zA-Z0-9]/g, '');
        }

        return baseName + '$i' + index;
    }

    static isHHTempVariable (name): boolean {
        return name.indexOf(TEMP_VARIABLE_PREFIX) === 0;
    }

    append (name: string) {
        this._list.push(name);
    }

    get (): string[] {
        return this._list;
    }
}
