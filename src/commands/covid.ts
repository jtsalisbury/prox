import { Message } from "discord.js";
import { IBaseCommand } from "../models/IBase";
import * as _utils from '../services/utils';

let getResults = function(location: string) {
    if (location == 'us') {
        return _utils.HTTPGet('https://api.covidtracking.com/v1/us/daily.json', {});
    }

    return _utils.HTTPGet(`https://api.covidtracking.com/v1/states/${location}/daily.json`, {});
}

let addCommas = function(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

let getFormat = function(location, type, covidData) {
    let updatedAt = (location == 'us') ? covidData[0].lastModified : covidData[0].lastUpdateEt;
    let updatedAtDate = new Date(updatedAt);

    let currentFormat = `> Current Covid Data for ${location.toUpperCase()} - last updated on ${updatedAtDate.toUTCString()}\n`;
    let dailyFormat = `> Historic Covid Data for ${location.toUpperCase()} - last updated on ${updatedAtDate.toUTCString()}\n`;

    if (type == 'current') {        
        let curData = covidData[0];
            
        let currentDataFormat = `Active Cases: ${addCommas(curData.positive)} (+${addCommas(curData.positiveIncrease)})
Deaths: ${addCommas(curData.death)} (+${addCommas(curData.deathIncrease)}), death rate of approx ${Math.round(curData.death / curData.positive * 100)}%
Currently Hospitalized: ${addCommas(curData.hospitalizedCurrently)} (+${addCommas(curData.hospitalizedIncrease)})
Recovered: ${addCommas(curData.recovered)}`;

        currentFormat += currentDataFormat;
    } else {
        
    }
    
    return (type == 'current') ? currentFormat : dailyFormat;
}




let states = ['us', 'al', 'ak', 'az', 'ar', 'ca', 'co', 'ct', 'de', 'dc', 'fl', 'ga', 'hi', 'id', 'il', 'in', 'ia', 'ks', 'ky', 'la', 'me', 'md', 'ma', 'mi', 'mn', 'ms', 'mo', 'mt', 'ne', 'nv', 'nh', 'nj', 'nm', 'ny', 'nc', 'nd', 'oh', 'ok', 'or', 'pa', 'ri', 'sc', 'sd', 'tn', 'tx', 'ut', 'vt', 'va', 'wa', 'wv', 'wi', 'wy', ]

let covid = <IBaseCommand>{};
covid.aliases = ['covid'];
covid.prettyName = 'Covid';
covid.help = 'Retrieves data about the current covid trends';
covid.category = 'Coronavirus';
covid.executeViaIntegration = false;
covid.params = [
    {
        name: 'location',
        type: 'list',
        allowedValues: states,
        optional: true,
        default: 'us'
    }/*,
    {
        name: 'type',
        type: 'list',
        allowedValues: ['historic', 'current'],
        optional: true,
        default: 'current'
    }*/
]
covid.callback = async function(message: Message, location: string, type: string) {

    let covidData = await getResults(location);
    
    return getFormat(location, 'current', covidData);
}

export let commands = [covid];