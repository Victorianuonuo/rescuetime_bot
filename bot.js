var SlackBot = require('slackbots');
var mongoose = require('mongoose');
//mongoose.connect(process.env.MONGODB_URI,{ useNewUrlParser: true }); // only when test bot.js
var models = require('./models');
const {google} = require('googleapis');
var {User, Apikey} = require('./models');
var slackID;
var _ = require('underscore')
var googleAuth = require('google-auth-library');
var CronJob = require('cron').CronJob;
var config = require('./config');

const envKey = process.env.NUDGE_BOT_TOKEN;
mongoose.Promise = global.Promise;

// create a bot
var bot = new SlackBot({
    token: envKey,
    name: 'nudgebot'
});

var oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.DOMAIN + '/connect/callback'
);

const startCronJob = function(time, is_print=false){
    var job = new CronJob({
        cronTime: '00 00 '+time+' * * *',
        onTick: function() {
            console.log('tick!');
            dailyCheck(is_print);
        }
    });
    job.start();
}

bot.on('start', function() {
    console.log('bot start!');
    for (var i = 0; i <= 23; i++) {
        var is_print=false;
        if(i==7)
          is_print=true;
        startCronJob(("00" + i).slice(-2),is_print);
    }
    //dailyCheck();
    //bot.postMessageToUser('so395', 'Hi, This is nudge bot!',{as_user:true}); 
    const MESSAGE = "Hi! This is nudge bot. We will inform you whether you have any event during the day at 7 am. Start with giving us permission to read your Google Calendar, and we would not edit or delete your calendar.";
    User.find({}, function(err, users){
        user_ids = Array.from(users, usr=>usr.slackID);
        bot.getUsers().then(users=>
            users.members.forEach(function(user){
                if(config.is_greet && !user_ids.includes(user.id) && !user.is_bot){
                    bot.postMessage(user.id, MESSAGE, {as_user:true}).then(() => authenticate(user.id));
                }
            }
        ));
    });

});


bot.on("message", message => {
    slackID = message.user;
    const userId = message.user;
    if(message.type!='error'){
        console.log('-----------------');
        console.log(message);
        console.log("Timenow: "+(new Date()).toISOString());
        console.log("Timenow: "+(new Date()));
        console.log('-----------------');
    }
    const MESSAGE = "Hi! You are connected with Google Calendar now! Reminders for every day's events will come in at 7 am.";
    switch (message.type) {
    case "message":
        if (message.channel[0] === "D" && message.bot_id === undefined) {
            User.findOne({slackID: slackID}).exec(function(err, user){
                if(err){
                    console.log(err)
                } else {
                    console.log(user);
                if(!user){
                    authenticate(slackID);
                } else {
                    console.log("message,", message);
                    bot.postMessage(message.user, MESSAGE, {as_user:true});
                    if(message.text ){
                        if(message.text.toLowerCase().includes('calendar')){
                            oneTimeCheck(user, true);
                        }else if(message.text.toLowerCase().includes('rescuetime')){
                            requestResuetime(slackID);
                        }
                        
                    }

                }
                }
            })
        }
        break;
    }
    
});

function authenticate(slackID){
    bot.postMessage(slackID, 'Please click the following button to activate your account' , {
    as_user:true,
    "attachments": [
        {
            "fallback": "activate",
            "actions": [
                {
                    "type": "button",
                    "text": "connect",
                    "url": process.env.DOMAIN + '/oauth?auth_id='+slackID
                }
            ]
        }
    ]
    });
}

function oneTimeCheck(user, is_print=false){
    userAuthen(user, is_print);
}

function dailyCheck(is_print=false){
    User.find({}, function(err, users) {
        if(err){
            console.log(err);
        }else{
            users.forEach(function(user) {
                userAuthen(user, is_print);
            });
        }
    });
}

function userAuthen(user, is_print=false){

    //oauth2Client.setCredentials(user.token);
    //console.log(oauth2Client);
    //listEvents(user, oauth2Client);

    oauth2Client.setCredentials({
        refresh_token: user.token.refresh_token
    });
    oauth2Client.getRequestHeaders().then(headers=>{
        var patten = 'Bearer ';
        var access_token = headers.Authorization.substring(patten.length);
        user.token.access_token = access_token;
        oauth2Client.setCredentials(user.token);
        //console.log(oauth2Client, user.email);
        user.save().then((user)=>{
            listEvents(user, oauth2Client, is_print);
        });
    });
}

function listEvents(user, auth, is_print=false) {
    const calendar = google.calendar({version: 'v3', auth});
    var timeMin = new Date();
    timeMin.setHours(0,0,0,0);
    var timeMax = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000);
    timeMax.setHours(0,0,0,0);
    console.log("timeMin: "+timeMin.toISOString()+" "+timeMin);
    console.log("timeMax: "+timeMax.toISOString()+" "+timeMax);
    calendar.events.list({
        auth: auth,
        calendarId: 'primary',
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        maxResults: 10, // caution here!
        singleEvents: true, // try to prevent empty list returned
        orderBy: 'startTime'
    }, (err, res) => {
        if (err) return console.log('The API returned an error: ' + err);
        const events = res.data.items;
        //console.log(events);
        if (events.length) {
            console.log('The number of events: '+ events.length, user.email);
            if(is_print){
                bot.postMessage(user.slackID, 'Fantastic job! You made plans today',{as_user:true});
            }
        } else {
            console.log('No upcoming events found.', user.email);
            if(is_print){
                bot.postMessage(user.slackID, 'You are slacking off. No plans made today',{as_user:true});
            }
        }
    });
}

function requestResuetime(slackID){
    Apikey.findOne({slackID: slackID}).exec(function(err, user){
        if(err){
            console.log(err)
        } else {
            console.log(user);
            if(!user){
                var requestData = {
                    as_user: true,
                    "text": "Would you like to add rescuetime as a data source?If so, go to https://www.rescuetime.com/anapi/manage to create an API key for us to read your rescuetime data",
                    "attachments": [
                    {
                        "text": "Ready to input the key",
                        "fallback": "You are unable to choose a rescuetime api",
                        "callback_id": "rescuetime",
                        "color": "#3AA3E3",
                        "attachment_type": "default",
                        "actions": [
                        {
                            "name": "rescuetime_api_key_yes",
                            "text": "Yes",
                            "type": "button",
                            "value": "Yes"
                        },
                        {
                            "name": "rescuetime_api_key_no",
                            "text": "No",
                            "type": "button",
                            "value": "No"
                        },
                        ]
                    }
                    ],
                };
                bot.postMessage(slackID,"",requestData);
            }else{
                bot.postMessage(slackID,"Congratulations! You successfully add rescuetime.",{as_user: true});
            }
        }
    });
}

module.exports = {
    bot: bot,
    requestResuetime: requestResuetime,
}
