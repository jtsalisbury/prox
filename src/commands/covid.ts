import { Message } from "discord.js";
import { IBaseCommand } from "../models/IBase";
import * as _utils from '../services/utils';
import * as regression from 'regression';

let getResults = function(location: string) {
    if (location == 'us') {
        return _utils.HTTPGet('https://api.covidtracking.com/v1/us/daily.json', {});
    }

    return _utils.HTTPGet(`https://api.covidtracking.com/v1/states/${location}/daily.json`, {});
}

let addCommas = function(x) {
    if (x == null) { return "n/a" }

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

    console.log(covidData)
    
    return getFormat(location, 'current', covidData);
}

let lastTwoWeeks = []
let population = 11689100
let pathTo50 = <IBaseCommand>{};
pathTo50.aliases = ['pathto50'];
pathTo50.prettyName = 'Path to 50';
pathTo50.help = 'Determines the day that Ohio\'s covid cases per 100,000 is at or below 50';
pathTo50.category = 'Coronavirus';
pathTo50.executeViaIntegration = false;
pathTo50.params = []
pathTo50.callback = async function(message) {
    let results = await getResults("oh")
    let curNum = 0
    for (let i = 1; i < 14; i++) {
        lastTwoWeeks.push([14 - i - 1, results[i].positiveIncrease])
        curNum += results[i].positiveIncrease
    }

    let casesPer100k = curNum / population * 100000

    let result = regression.exponential(lastTwoWeeks)
    let a = result.equation[0]
    let b = result.equation[1]

    let daysFromNowExc = Math.log(50/a)/b - 1

    let targetDate = new Date()
    targetDate.setDate(targetDate.getDate() + Math.ceil(daysFromNowExc))

    return `There are currently ${Math.round(casesPer100k)} cases per 100,000 people.\nUsing Ohio case data, we can expect the number of cases to be at 50 per 100,000 on ${targetDate.toDateString()}\nPlease note: This is a gross overestimation, as Ohio's official calculation does not include COVID cases in prisons, but our data does not distinguish this.`
}

export let commands = [covid, pathTo50];