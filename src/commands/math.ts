import { evaluate } from 'mathjs';
import { IBaseCommand } from '../models/IBase';

let calc = <IBaseCommand>{};
calc.aliases = ['calc', 'calculate'];
calc.prettyName = 'Calculate';
calc.help = 'Evaluate a math expression';
calc.executeViaIntegration = true;
calc.params = [
    {
        name: 'expression',
        type: 'string'
    }
];
calc.callback = async function(_, expression) {
    try {
        let result = evaluate(expression);

        return expression + ' = ' + result;

    } catch(e) {
        return 'Unable to perform operation';
    }
}

export let commands = [calc];