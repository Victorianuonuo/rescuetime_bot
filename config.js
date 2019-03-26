var mongoose = require('mongoose');
//mongoose.connect(process.env.MONGODB_URI,{ useNewUrlParser: true }); // only when test bot.js
var {ConfigUser} = require('./models/models');
mongoose.Promise = global.Promise;

function json2func(configfile){
    return {
        get_incoming: function() {
            return configfile.incoming;
        },
        get_outgoing: function() {
            return configfile.outgoing;
        },
        get_dayname: function() {
            return ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
        },
        get_frequency: function() {
            return configfile.frequency;
        },
        get_tickday: function(){
            return configfile.tickday || 0;
        },
        num_of_event: function(num) {
            if(!num) {
                return configfile.num_of_event["0"];
            }
            return configfile.num_of_event["1"];
        },
        get_ignore: function() {
            return configfile.ignore;
        },
        testing: function() {
            return configfile.outgoing;
        }
    }
}

var Config = function(usr, auth, is_print, callback){

    var slackID = usr.slackID;

    console.log("here"+slackID);

    var configfile;

    ConfigUser.findOne({slackID: slackID}).exec(function(err, user){
        if(err){
            console.log(err)
            console.log(slackID, "Not found in ConfigUser");
        }else{
            if(user){
                console.log(slackID, "found in ConfigUser");
                console.log(user);
                configfile = JSON.parse(user.configJson);
            }else{
                console.log("Fail to load from ConfigUser, read from local file instead.");
                configfile = require('./resources/config.json');
            }
            //console.log(configfile);
            configfile = json2func(configfile);
            callback(usr, auth, configfile, is_print);
        }
    });
}

module.exports = Config;