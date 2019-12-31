let request = require('request');
let {ROLES} = require('../classes/RoleConstants');
let utils = {};

/**
 * Generate a new HTTP GET request
 * @param {String} url, the url to GET from
 * @param {Object} headers, a list of optional headers for the request
 * 
 * @returns {Promise} a promise which resolves to an object
 */
utils.HTTPGet = function(url, headers) {
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
            resolve(JSON.parse(body));
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
utils.HTTPPost = function(url, payload) {
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
utils.parseLine = function (line) {
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

utils.getRoles = function() {
    return ROLES;
}

module.exports = utils;