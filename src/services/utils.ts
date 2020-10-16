import request from 'request';
import Command from '../models/Command';

export let resolve = function(obj: object, path: string[] | string, value?: string): object | string {
    // Path is a string still, split it
    if (typeof path == 'string') {
        return resolve(obj, path.split('.'), value);
    }
    
    // Property doesn't exist, create it
    if (!obj[path[0]] && path[0]) {
        obj[path[0]] = {}
    }

    // Set the property
    if (path.length == 1 && value != undefined) {
        return obj[path[0]] = value;
    }

    // Return the value
    if (path.length == 0) {
        return obj;
    }

    // Keep recursively going
    return resolve(obj[path[0]], path.slice(1), value);
}

/**
 * Generate a new HTTP GET request
 * @param {String} url, the url to GET from
 * @param {Object} headers, a list of optional headers for the request
 * 
 * @returns {Promise} a promise which resolves to an object
 */
export let HTTPGet = function(url: string, headers?: object): Promise<object> {
    return new Promise((resolve, reject) => {
        // Create a enw request
        request.get({
            url: url,
            rejectUnauthorized: false,
            headers: headers
        }, function(err, res, body) {
            // Reject the promise if there's an error
            if (err) {
                reject(err);
            }

            // Return the resolved promise
            try {
                let res = JSON.parse(body);
                resolve(res);
            } catch(e) { // if it's not a json result
                resolve(body);
            }
        });
    });
};


/**
 * Generate a new HTTP POST request
 * @param {String} url, the url to POST to
 * @param {Object} payload, whatever info we should send!
 * 
 * @returns {Promise} a promise which resolves to an object
 */
export let HTTPPost = function(url: string, payload: object): Promise<object> {
    return new Promise((resolve, reject) => {
        // Create a new request
        request.post(url, {
            rejectUnauthorized: false,
            json: payload
        }, function(err, res, body) {
            // If there's an error reject the promise
            if (err) {
                reject(err);
            }

            // Resole to the body of the result
            resolve(body);
        });
    });
};

/**
 * This function will take a string of text and split it into parts depending on quotes and spaces
 * @param {String} line, the line of text we should parse
 * 
 * @returns {Array}, the split parts of the string, seperated by quotes and spaces
 */
export let parseLine = function (line: string): string[] {
    let index = 0;
    let parts = [];
    let quotes = {
        "'": true,
        '"': true
    }
    
    // While we are still within bounds..
    while (index !== null) {
        let curChar = line[index];
        if (!curChar) {
            break;
        }

        // If the current character is a space, keep going
        if (curChar === ' ') {
            index += 1;
        } else if (quotes[curChar]) {
            // So we are in a quote, let's search for the end quote
            let closingQuoteIndex = line.indexOf(curChar, index + 1);
            // How many characters are between the quotes?
            let charsBetween = closingQuoteIndex - index - 1; 
            // Grab either the string between the quotes or all the way to the end of the string
            let quotedString = line.substr(index + 1, closingQuoteIndex !== -1 ? charsBetween : undefined); 
            parts.push(quotedString); 
            // We can't find the closing quote, so we'll treat the remaining string as the quote
            if (closingQuoteIndex === -1) {
                break;
            }
            // Increment to the character after the closing quote
            index = closingQuoteIndex + 1;
        } else {
            // We didn't find a quote
            // Find where the next space occurs
            let nextSpaceIndex = line.indexOf(' ', index + 1); 
            // Grab the characters between the two spaces (a word!)
            let charsBetween = nextSpaceIndex - index; 
            let word = line.substr(index, nextSpaceIndex !== -1 ? charsBetween : undefined)  
            parts.push(word);
            // We can't find another space, so we only have one word left!
            if (nextSpaceIndex === -1) {
                break;
            }
            // Move to the next space position
            index = nextSpaceIndex + 1;
        }
    }

    return parts;
};

/**
 * Returns a formatted help string for a command
 * @param command, the command
 * @param alias, the command alias
 */
export let cmdHelp = function(command: Command, alias: string): string {
    let paramHelp = "";
    
    command.getParams().forEach(param => {
        let optText = param.isOptional() ? 'optional, default: ' + (param.getDefault() == undefined ? 'nothing' : param.getDefault()) : 'required';

        paramHelp += `<${param.getName()} (${param.getType()}, ${optText})> `;
    });

    return `\`!${alias} ${paramHelp}\n\``
}