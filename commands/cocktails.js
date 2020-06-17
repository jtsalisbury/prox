let _utils = require('@services/utils');

// Formats a cocktail info to be pretty
let formatCocktailInfo = function(info) {
    let name = info.strDrink;
    let instructions = info.strInstructions;

    let ingredientList = '';

    // Loop through ingredients
    for (let i = 1; i <= 15; i++) {
        let ingField = 'strIngredient' + i;
        let mixField = 'strMeasure' + i;

        if (info[ingField] == null) {
            break;
        }

        let mixAmt = 'to taste';
        if (info[mixField] != null) {
            mixAmt = info[mixField];
        }

        ingredientList += `, ${info[ingField]}(${mixAmt})`;
    }

    // Return the pretty string
    return `**${name}**\nIngredients: ${ingredientList.substr(1, ingredientList.length)}\n${instructions}`;
}

let cocktail = {};
cocktail.aliases = ['cocktail', 'drink'];
cocktail.prettyName = 'Get a cocktail';
cocktail.help = 'Gets info about a cocktail (or a random one!)';
cocktail.params = [
    {
        name: 'drink name',
        type: 'string', 
        optional: true
    },
    {
        name: 'list all drinks',
        type: 'bool',
        optional: true
    }
]
cocktail.callback = async function(_, search, showAll) {
    let result;

    // We're trying to find a cocktail by name
    if (search) {
        let results = await _utils.HTTPGet(`https://www.thecocktaildb.com/api/json/v1/1/search.php?s=${search}`, {});

        if (!results || !results.drinks || results.drinks.length == 0) {
            return 'No results';
        }

        // We opted to show all the names 
        if (showAll) {
            let drinks = '';
            for (let i = 0; i < results.drinks.length; i++) {
                drinks += `, ${results.drinks[i].strDrink}`;
            }

            return `We found ${results.drinks.length} drinks: ${drinks.substr(1, drinks.length)}`;

        } else {
            // Just show the original
            return `We found ${results.drinks.length} drinks. The first one is: ${formatCocktailInfo(results.drinks[0])}`;
        }

    } else {
        // Get a random cocktail!
        result = await _utils.HTTPGet('https://www.thecocktaildb.com/api/json/v1/1/random.php?a=Alcoholic', {}); 

        if (!result) {
            return 'No results';
        }
    
        let drink = result.drinks;
        if (!drink || drink.length == 0) {
            return 'No results';
        }
    
        return `Your random drink: ${formatCocktailInfo(drink[0])}`;
    }
}

module.exports.commands = [cocktail];