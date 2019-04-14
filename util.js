
var made_it_gif = [
    "https://media.giphy.com/media/1ZDCyTHjA4fYYKJPRx/giphy.gif",
    "https://media.giphy.com/media/zaqclXyLz3Uoo/giphy.gif",
    "https://media.giphy.com/media/11Feog5PTumNnq/giphy.gif",
    "https://media.giphy.com/media/skmziDEEjiin6/giphy.gif",
    "https://media.giphy.com/media/NppB385x566nm/giphy.gif",
    "https://media.giphy.com/media/MSCzxrLEF25feISTIz/giphy.gif",
    "https://media.giphy.com/media/lnlAifQdenMxW/giphy.gif",
    "https://media.giphy.com/media/l4EpblDY4msVtKAOk/giphy.gif",
    "https://media.giphy.com/media/3ohs7O2afIz1a8bWPm/giphy.gif",
    "https://media.giphy.com/media/NWyknTtYr114s/giphy.gif",
    "https://media.giphy.com/media/Wx9ygu5vPO5G61C9pk/giphy.gif",
    "https://media.giphy.com/media/dkGhBWE3SyzXW/giphy.gif",
    "https://media.giphy.com/media/l2Sqir5ZxfoS27EvS/giphy.gif",
    "https://media.giphy.com/media/YXpp9YxWhyWBy/giphy.gif",
    "https://media.giphy.com/media/l0MYDTnJ3bebIQOac/giphy.gif",
    "https://media.giphy.com/media/Afu7T2y2V7cdi/giphy.gif",
    "https://media.giphy.com/media/YXPZ3W7UAVOZW/giphy.gif"
]

var daily_support_gif = [
    "https://media.giphy.com/media/12XDYvMJNcmLgQ/giphy.gif",
    "https://media.giphy.com/media/3oEduLl7trWHEWdO5a/giphy.gif",
    "https://media.giphy.com/media/3og0IPMeREHpEV0f60/giphy.gif",
    "https://media.giphy.com/media/V9ppKIzlMhdtK/giphy.gif",
    "https://media.giphy.com/media/uB0JLGv5UHrALv7oTp/giphy.gif",
    "https://media.giphy.com/media/1fXcl6MEoOQvbOw3ZS/giphy.gif",
    "https://media.giphy.com/media/l0IygGHnmhAHpnlvO/giphy.gif",
    "https://media.giphy.com/media/WS4iVW47O6jql0IAQZ/giphy.gif",
    "https://media.giphy.com/media/g4IP5h88PVv1JqD3PO/giphy.gif",
    "https://media.giphy.com/media/NgN5nviC9YovK/giphy.gif",
    "https://media.giphy.com/media/7Japr7jWDPH3HryOnW/giphy.gif",
    "https://media.giphy.com/media/3ohzdTQaODeGPt90uk/giphy.gif",
    "https://media.giphy.com/media/3o85xIehqbS3TVyLN6/giphy.gif",
    "https://media.giphy.com/media/l46CgUEZgpaJblGwM/giphy.gif",
    "https://media.giphy.com/media/j0NBEpVZzqRxjnr1eH/giphy.gif"
]

function getMadeItGIF() {
    var max = made_it_gif.length;
    return made_it_gif[getRandomInt(max)];
}

function getDailySupportGIF() {
    var max = daily_support_gif.length;
    return daily_support_gif[getRandomInt(max)];
}

function getRandomInt(max) {
    return Math.floor(Math.random() * Math.floor(max));
}


module.exports = {
    getDailySupportGIF: getDailySupportGIF,
    getMadeItGIF: getMadeItGIF
}