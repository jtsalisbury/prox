let _utils = require('@services/utils');

let weather = {};
weather.aliases = ['weather'];
weather.prettyName = 'Weather';
weather.help = 'Check the weather in a city';
weather.params = [
    {
        name: 'location (city,state)',
        type: 'string'
    }
];
weather.callback = async function(_, location) {
    let url = `https://community-open-weather-map.p.rapidapi.com/weather?q=${location}`
    let headers = {
        "x-rapidapi-host": "community-open-weather-map.p.rapidapi.com",
        "x-rapidapi-key": process.env.WEATHER_APIKEY
    };

    let result = await _utils.HTTPGet(url, headers);

    if (result.cod === '404') {
        return 'Couldn\'t find that city! Try re-phrasing it';
    }

    let temps = result.main;

    // Convert from kelvin to Farenheiht
    let temp = (temps.temp - 273.15) * 9 / 5 + 32;
    let feels = (temps.feels_like - 273.15) * 9 / 5 + 32;
    let tempMax = (temps.temp_max - 273.15) * 9 / 5 + 32;
    let tempMin = (temps.temp_min - 273.15) * 9 / 5 + 32;

    let str = `${result.name} is seeing ${result.weather[0].description}\nTemp: ${temp.toFixed(2)}F (feels like ${feels.toFixed(2)}F), Max: ${tempMax.toFixed(2)}F, Min: ${tempMin.toFixed(2)}F\nHumidity: ${temps.humidity}\nWind speed: ${result.wind.speed}`

    return str;
}

module.exports.commands = [weather];