import { Expression } from 'estree';
import { Syntax } from 'esotope-hammerhead';

export default class TempVariables {
    private static _tempVariableId = 0;
    private _variables: string[] = [];

    static resetId () {
        TempVariables._tempVariableId = 0;
    }

    static generate(baseName?: string, key?: Expression, index?: number): string {
        if (!baseName)
            return `_hh$temp${TempVariables._tempVariableId++}`;

        if (key) {
            if (key.type === Syntax.Identifier)
                return baseName + '$' + key.name;

            if (key.type === Syntax.Literal)
                return baseName + '$' + key.value.toString().replace(/[^a-zA-Z0-9]/g, '');
        }

        return baseName + '$i' + index;
    }

    append (name: string) {
        this._variables.push(name);
    }

    get (): string[] {
        return this._variables;
    }
}
