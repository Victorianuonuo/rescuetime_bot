var SlackBot = require('slackbots');
var mongoose = require('mongoose');
//mongoose.connect(process.env.MONGODB_URI,{ useNewUrlParser: true }); // only when test bot.js
const {google} = require('googleapis');
var {User, Apikey, ConfigUser, WeeklyPlan} = require('./models');
var slackID;
var _ = require('underscore')
var googleAuth = require('google-auth-library');
var CronJob = require('cron').CronJob;
var Config = require('./config');
var axios = require('axios');
var is_greet = false;

const envKey = process.env.NUDGE_BOT_TOKEN;
mongoose.Promise = global.Promise;

// create a bot
var bot = new SlackBot({
    token: envKey,
    name: 'nudgebot'
});

const startCronJob = function(time, is_print=false){
    var job = new CronJob({
        cronTime: '00 00 '+time+' * * *',
        onTick: function() {
            console.log('startCronJob tick!');
            dailyCheck(is_print);
        }
    });
    job.start();
}

const startWeeklyPlanner = function(){
    var job = new CronJob({
        cronTime: '00 30 07 * * 1',
        onTick: function() {
            console.log('startWeeklyPlanner tick!');
            weeklyPlanner();
        }
    });
    job.start();
}

const startDailyReminder = function(){
    var job = new CronJob({
        cronTime: '00 30 07 * * 0,2-6',
        onTick: function() {
            console.log('startDailyReminder tick!');
            dailyReminder();
        }
    });
    job.start();
}

function newPlan(user){
    var requestData = {
        as_user: true,
        "text": "Click here to make a plan for this week!!!",
        "attachments": [
            {
                "text": "",
                "fallback": "You are unable to propose new plan",
                "callback_id": "newplan",
                "color": "#3AA3E3",
                "attachment_type": "default",
                "actions": [
                    {
                        "name": "new_plan_button",
                        "text": "Plan",
                        "type": "button",
                        "value": "yes_plan"
                    },
                ]
            }
        ],
    };
    bot.postMessage(user.slackID,"",requestData);
}

function weeklyPlanner(){
    console.log("enter weeklyPlanner");
    Apikey.find({}, function(err, users) {
        if(err){
            console.log(err);
        }else{
            users.forEach(function(user) {
                console.log("weekly plan for ", user);
                weeklyReport(user.slackID, user.rescuetime_key);
                setTimeout(function(){newPlan(user);}, 600);
            });
        }
    });
}

function dailyReminder(){
    var week = getMonday(new Date()).toDateString();
    WeeklyPlan.find({week:week}).exec(function(err, users){
        if(err){
            console.log(err);
        }else{
            users.forEach(function(user) {
                console.log("daily reminder for ", user);
                dailyReport(user.slackID, user.week, user.plans);
            });
        }
    });
}

function printWeeklyPlan(slackID, plans, last){
    console.log("printWeeklyPlan", plans, last);
    var plan_string = last?"You planned to spend":"You plan to spend";
    const features = ["software_development", "writing", "learning"];
    for(var idx in features){
        plan_string += " "+Number(plans.get(features[idx])).toFixed(2)+" hours on "+features[idx]+",";
    }
    plan_string += " and achieve ";
    plan_string += Number(plans.get("productivity")).toFixed(2);
    plan_string += last?" on productivity last week.":" on productivity this week.";
    bot.postMessage(slackID, plan_string, {as_user:true});
}

function pastWeekPlan(slackID, plans, access_token){
    var url = "https://www.rescuetime.com/api/oauth/daily_summary_feed?access_token="+access_token;
    console.log("urlll: ", url);
    console.log("pastWeekPlan plans, ", plans);
    axios.get(url).then(function(response){
        var datas = response.data.slice(0, 7);
        const features = {"software_development":"software_development_hours", "writing":"design_and_composition_hours", "learning":"reference_and_learning_hours"};
        var result = {"software_development_hours":0, "design_and_composition_hours":0, "reference_and_learning_hours":0, "productivity_pulse":0};
        const all_features = {"software_development":"software_development_hours", "writing":"design_and_composition_hours", "learning":"reference_and_learning_hours", "productivity": "productivity_pulse"};
        //console.log(datas[0]);
        for(var feature in features){
            for(var i=0;i<7;i++){
                result[features[feature]] += datas[i][features[feature]];
            }
        }
        for(var i=0;i<7;i++){
            result["productivity_pulse"] += datas[i]["productivity_pulse"];
        }
        result["productivity_pulse"] /= 7.0;
        console.log("result,", result);
        printDailyReport(slackID, result, true);
        setTimeout(function(){
            const promises = Object.keys(all_features).map(function (feature, index) {
                if(result[all_features[feature]]>=plans.get(feature)){
                    bot.postMessage(slackID, "You did great in achieving your goal on "+feature+" last week.", {as_user:true});
                    return 1;
                }else{
                    bot.postMessage(slackID, "You did not achieve your goal on "+feature+" last week.", {as_user:true});
                    return 0;
                }
            });
            Promise.all(promises).then(function (perfs) {
                var num = perfs.reduce((a, b) => a + b, 0);
                if(num==4){
                    setTimeout(function(){bot.postMessage(slackID, "Congratulations! You achieved all your goals set last week. Keep on!", {as_user:true})}, 100);
                }else{
                    setTimeout(function(){bot.postMessage(slackID, "Ooops! You didn't achieve all the goals set last week. Make it this week!", {as_user:true})}, 100);
                }
            })
        },200);
        // if(plans){
        //     var perf = 0;
        //     for(var feature in all_features){
        //         if(result[all_features[feature]]>=plans.get(feature)){
        //             perf+=1;
        //             bot.postMessage(slackID, "You did great in achieving your goal on "+feature+" last week.", {as_user:true});
        //         }else{
        //             bot.postMessage(slackID, "You did not achieve your goal on "+feature+" last week.", {as_user:true});
        //         }
        //     }
        //     if(perf==4){
        //         bot.postMessage(slackID, "Congratulations! You achieved all your goals set last week. Keep on!", {as_user:true});
        //     }else{
        //         bot.postMessage(slackID, "Ooops! You didn't achieve all the goals set last week. Make it this week!", {as_user:true});
        //     }
        // }
    }).catch(function(err){
        console.log("last week report err ", err);
        bot.postMessage(slackID, "Sorry! Cannot read your last week's activity.", {as_user:true});
    });
}


function weeklyReport(slackID, access_token){
    var lastweek = getMonday(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).toDateString();
    WeeklyPlan.findOne({slackID:slackID, week:lastweek}).exec(function(err, user){
        var plans;
        if(err){
            console.log(err);
        }else{
            if(user){
                console.log(user);
                printWeeklyPlan(slackID, user.plans, true);
                plans = user.plans;
            }else{
                bot.postMessage(slackID, "You don't set goals last week.", {as_user:true});
            }
        }
        pastWeekPlan(slackID, plans, access_token);
    });
}

function printDailyReport(slackID, data, lastweek=false){
    var daily_report = "And you spent";
    const features = {"software_development":"software_development_hours", "writing":"design_and_composition_hours", "learning":"reference_and_learning_hours"};
    for(var feature in features){
        daily_report += " "+Number((data[features[feature]]).toFixed(2))+" hours on "+feature+",";
    }
    daily_report += " and your productivity pulse was "+Number((data["productivity_pulse"]).toFixed(2))+(lastweek?" last week.":" yesterday.");
    bot.postMessage(slackID, daily_report, {as_user:true});
}

function dailyReport(slackID, week, plans){
    Apikey.findOne({slackID: slackID}).exec(function(err, user){
        if(err){
            console.log(err);
        }else{
            if(user){
                console.log(user);
                var access_token = user.rescuetime_key;
                printWeeklyPlan(slackID, plans, false);
                var url = "https://www.rescuetime.com/api/oauth/daily_summary_feed?access_token="+access_token;
                console.log("urlll: ", url);
                //var today = new Date(Date.now()- 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                //console.log("today, ", today);
                axios.get(url).then(function(response){
                    var data = response.data[0];
                    printDailyReport(slackID, data);
                });
            }else{
                console.log("Fail to load rescuetime api access_token");
                bot.postMessage(user.slackID, "Ooops! Couldn't link with your rescuetime account. Start by giving me access to your rescuetime account", {as_user:true});
                authenResuetime(user.slackID);
            }
        }
    });
}



bot.on('start', function() {
    console.log('bot start!');
    for (var i = 0; i <= 23; i++) {
        var is_print=false;
        if(i==7)
          is_print=true;
        startCronJob(("00" + i).slice(-2),is_print);
    }
    startDailyReminder();
    startWeeklyPlanner();
    //weeklyPlanner();
    //dailyReminder();
    //dailyCheck();
    //bot.postMessageToUser('so395', 'Hi, This is nudge bot!',{as_user:true}); 
    const MESSAGE = "Hi! This is nudge bot. We will inform you whether you have any event during the day at 7 am. Start with giving us permission to read your Google Calendar, and we would not edit or delete your calendar.";
    User.find({}, function(err, users){
        user_ids = Array.from(users, usr=>usr.slackID);
        bot.getUsers().then(users=>
            users.members.forEach(function(user){
                if(is_greet && !user_ids.includes(user.id) && !user.is_bot){
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
                    console.log(err);
                } else {
                    console.log(user);
                    if(!user){
                        authenticate(slackID);
                    } else {
                        console.log("message,", message);
                        bot.postMessage(message.user, MESSAGE, {as_user:true});
                        if(message.text){
                            if(message.text.toLowerCase().includes('calendar')){
                                oneTimeCheck(user, true);
                            }else if(message.text.toLowerCase().includes('rescuetime')){
                                authenResuetime(slackID);
                                //requestResuetime(slackID);
                            }else if(message.text.includes("weeklyPlanner")){
                                weeklyPlanner();
                                //dailyReminder();
                            }else if(message.text.includes("dailyReminder")){
                                //weeklyPlanner();
                                dailyReminder();
                            }
                        }
                    }
                }
            });
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

    var oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.DOMAIN + '/connect/callback'
    );

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
            configThenList(user, oauth2Client, is_print);
        });
    });
}

function configThenList(user, auth, is_print=false){
    Config(user, auth, is_print, listEvents);
}

function listEvents(user, auth, config, is_print=false) {
    var today = (new Date()).getDay();
    console.log(user, auth, config, is_print);
    if(config.get_frequency()=='weekly' && today!=config.get_tickday()){
        is_print = false;
        console.log("today config.frequency not print",today, config.get_frequency());
    }
    if(config.get_ignore().includes(config.get_dayname()[today])){
        is_print = false;
        console.log("Ignore!!! today config.ignore", today, config.get_ignore());
    }

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
        console.log(events);
        if (events.length) {
            console.log('The number of events: '+ events.length, user.email);
            if(is_print){
                bot.postMessage(user.slackID, config.num_of_event(events.length),{as_user:true});
            }
        } else {
            console.log('No upcoming events found.', user.email);
            if(is_print){
                bot.postMessage(user.slackID, config.num_of_event(events.length),{as_user:true});
            }
        }
    });
}

function authenResuetime(slackID){
    console.log("enter authenResuetime");
    Apikey.findOne({slackID: slackID}).exec(function(err, user){
        if(err){
            console.log(err);
        } else {
            console.log(user);
            if(!user){
                bot.postMessage(slackID, 'Please click the following button to add rescuetime as a data source.' , {
                    as_user:true,
                    "attachments": [
                        {
                            "fallback": "activate",
                            "actions": [
                                {
                                    "type": "button",
                                    "text": "connect",
                                    "url": process.env.DOMAIN + '/apikey/rescuetime/oauth?auth_id='+slackID
                                }
                            ]
                        }
                    ]
                });
            }else{
                bot.postMessage(slackID,"Congratulations! You successfully add rescuetime.",{as_user: true});
            }
        }
    });
}

function requestResuetime(slackID){
    Apikey.findOne({slackID: slackID}).exec(function(err, user){
        if(err){
            console.log(err);
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

function getMonday(d) {
  d = new Date(d);
  //d.setHours(0,0,0,0);
  var day = d.getDay(),
      diff = d.getDate() - day + (day == 0 ? -6:1); // adjust when day is sunday
  return new Date(d.setDate(diff));
}

module.exports = {
    bot: bot,
    requestResuetime: requestResuetime,
    authenResuetime: authenResuetime,
    getMonday: getMonday,
}
