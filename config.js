config = require('./resources/config.json');
var frequency2number = {'daily':1, 'weekly': 7};
config.days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
config.frequency = frequency2number[config.frequency];
config = {...config, ...{is_greet : false}};
console.log(config);

module.exports = config;