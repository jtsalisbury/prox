let {evaluate} = require('mathjs');

let calc = {};
calc.aliases = ['calc', 'calculate'];
calc.prettyName = 'Calculate';
calc.help = 'Evaluate a math expression';
calc.params = [
    {
        name: 'expression',
        type: 'string'
    }
];
calc.callback = function(_, expression) {
    let result = evaluate(expression);

    return expression + ' = ' + result;
}

module.exports.commands = [calc];