var SlackBot = require('slackbots');
var mongoose = require('mongoose');
//mongoose.connect(process.env.MONGODB_URI,{ useNewUrlParser: true }); // only when test bot.js
var {Apikey, SlackKey, WeeklyMultiPlan, ShortFocus, DistractionsDelay} = require('./models/models');
var _ = require('underscore')
var CronJob = require('cron').CronJob;
var axios = require('axios');
var {getDailySupportGIF, getMadeItGIF} = require('./util');
const envKey = process.env.NUDGE_BOT_TOKEN;
var moment = require('moment');
mongoose.Promise = global.Promise;

// create a bot
var bot = new SlackBot({
    token: envKey,
    name: 'nudgebot'
});
var {quickReactionTest, reactionMsg} = require('./quickReaction');

const startDistractionCheck = function(){
    var job = new CronJob({
        cronTime: '00 1,31 * * * 1-5',
        onTick: function() {
            console.log('startDistractionCheck tick!');
            distractionCheck();
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

function distractionCheck(trigger=null){
    Apikey.find({}, function(err, users) {
        if(err){
            console.log(err);
        }else{
            for(var i=0;i<users.length;i++){
                //if(!trigger&&['UG0BHGBMX', 'UG0TDA2SW'].includes(users[i].slackID) || trigger==users[i].slackID){
                if(!trigger || trigger==users[i].slackID){
                   distractionCheck_users(users[i], trigger==users[i].slackID);
                }
            }
        }
    });
}

function formatMinutes(minutes){
    var hours = Math.floor(minutes/60);
    var minutes = Math.floor(minutes-hours*60);
    var hours_str = hours?hours+(hours>1?' hours':' hour'):'';
    var minutes_str = minutes?minutes+(minutes>1?' minutes':' minute'):'';
    return hours_str+' '+minutes_str;
}

function distractionCheck_users(rescuetime_user, trigger=false){
    //console.log("distractionCheck_users", trigger);
    var rescuetimeKey = rescuetime_user.rescuetime_key;
    var d = new Date();
    //var date = d.toISOString().split('T')[0];;
    var date = moment().format().split('T')[0];
    console.log('distractionCheck_users', date);
    if(rescuetimeKey) {
        var url = "https://www.rescuetime.com/api/oauth/data";
        var secs = 0;
        DistractionsDelay.findOne({slackID:rescuetime_user.slackID, date:date}).exec(function(err, user){
            axios.get(url, {
                    params: {
                        access_token: rescuetimeKey,
                        // restrict_begin: date,
                        // restrict_end: date,
                        format: 'json' ,
                        perspective: 'interval',
                        resolution_time: 'hour',
                    }
                })
                .then(function(res){
                    var data = res.data;
                    for(var i=0; i<data.rows.length; i++) {
                        if(data.rows[i][5] < 0) {
                            secs += Number(data.rows[i][1]);
                        }
                    }
                    var past_secs = 0;
                    var newDistractionsDelay = user;
                    if(!user||user.time_spend!=secs){
                        if(user){
                            past_secs = user.time_spend+user.time_left;
                            user.time_spend = secs;
                            user.time_left = Math.max(0, past_secs-secs);
                            user.ts = Math.round(new Date().getTime()/1000)-3;
                        }else{
                            newDistractionsDelay = new DistractionsDelay({
                                slackID: rescuetime_user.slackID,
                                date: date,
                                time_left: 0,
                                time_spend: secs,
                                ts: Math.round(new Date().getTime()/1000)-3,
                                skip: false
                            });
                        }
                        newDistractionsDelay.save()
                        .then(() => {
                            console.log("newDistractionsDelay save for ", rescuetime_user.slackID);
                            console.log(newDistractionsDelay);
                        })
                        .catch((err) => {
                            console.log("newDistractionsDelay save for "+rescuetime_user.slackID, err);
                        });
                        if(secs>30*60&&!newDistractionsDelay.skip||trigger){
                            if(!past_secs || secs>past_secs){
                                var requestData = {
                                    as_user: true,
                                    "text": "You have spent "+formatMinutes(secs/60)+" on distractions today! Try to avoid additional distractions.",
                                    "attachments": [
                                    {
                                        "text": "",
                                        "fallback": "You are unable to choose a distraction option",
                                        "callback_id": "distraction_delay",
                                        "color": "#3AA3E3",
                                        "attachment_type": "default",
                                        "actions": [
                                            {
                                                "name": "distraction_delay_minutes",
                                                "text": "Allow spending more minutes",
                                                "type": "select",
                                                "options": [
                                                    {
                                                    "text": "30 minutes more",
                                                    "value": "30"
                                                    },
                                                    {
                                                    "text": "60 minutes more",
                                                    "value": "60"
                                                    },
                                                    {
                                                    "text": "90 minutes more",
                                                    "value": "90"
                                                    },
                                                    {
                                                    "text": "120 minutes more",
                                                    "value": "120"
                                                    },
                                                ],
                                            },
                                        ]
                                    },
                                    {
                                        "text": "",
                                        "fallback": "You are unable to choose a later today button",
                                        "callback_id": "distraction_later",
                                        "color": "#3AA3E3",
                                        "attachment_type": "default",
                                        "actions": [
                                            {
                                                "name": "distraction_delay_later",
                                                "text": "Remind me later",
                                                "type": "button",
                                                "value": "0"
                                            },
                                        ]
                                    },
                                    {
                                        "text": "",
                                        "fallback": "You are unable to choose a skip today button",
                                        "callback_id": "distraction_skip",
                                        "color": "#3AA3E3",
                                        "attachment_type": "default",
                                        "actions": [
                                            {
                                                "name": "distraction_delay_skip",
                                                "text": "Thank you, no more today",
                                                "type": "button",
                                                "value": "-1"
                                            },
                                        ]
                                    },
                                ],
                            };
                            bot.postMessage(rescuetime_user.slackID,"",requestData);
                            }
                        }
                    }else if(newDistractionsDelay.skip){
                        console.log('newDistractionsDelay.skip',rescuetime_user.slackID);
                    }else{
                        console.log("user don't spend more time on distractions", rescuetime_user.slackID);
                    }
                });
            });
    }
}

function newPlan(slackID, message){
    if(message == undefined) {
        message = "Click here to make a plan for this week!!!"
    }
    var requestData = {
        as_user: true,
        "text": `${message}`,
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
    bot.postMessage(slackID,"",requestData);
}

function weeklyPlanner(trigger=null){
    console.log("enter weeklyPlanner");
    Apikey.find({features:'new_plan'}, function(err, users) {
        if(err){
            console.log(err);
        }else{
            users.forEach(function(user) {
                if(!trigger || trigger==user.slackID){
                    console.log("weekly plan for ", user);
                    weeklyReport(user.slackID, user.rescuetime_key);
                    setTimeout(function(){newPlan(user.slackID);}, 800);
                }
            });
        }
    });
}

function dailyReminder(trigger=null){
    var week = getMonday(new Date()).toDateString();
    WeeklyMultiPlan.find({week:week, done:false}).exec(function(err, users){
        if(err){
            console.log(err);
        }else{
            //console.log("$$$$$get users: ", users); 
            if(users && users.length > 0){
                users.forEach(function(user) {
                    if(!trigger || trigger==user.slackID){
                        console.log("########daily reminder for ", user);
                        dailyReport(user.slackID, user.week, user.plans);
                    }
                });
            } else {
                console.log("########## no plan this week");
                if(trigger) {
                    bot.postMessage(trigger, "You don't have any plan yet.", {as_user:true});
                    newPlan(trigger);
                }
            }
        }
    });
}

function printWeeklyPlan(slackID, plans, last){
    console.log("printWeeklyPlan", plans, last);
   return [{
    "type": "section",
    "text": {
        "type": "mrkdwn",
        "text": `You decided to spend *${plans.get("focus_hours")} hours* focusing on *${plans.get("weekly_focus")}*.`,
    }},{
        "type": "divider"
    }];
}

function printWeeklyReport(slackID) {
    var achieved = [];
    var not_achieved = [];
    var lastweek = getMonday(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).toDateString(); 
    var message = [{
        "type": "section",
        "text": {
            "type": "mrkdwn",
            "text": "_*This is your weekly report*_",
    }}];
    WeeklyMultiPlan.find({slackID:slackID, week:lastweek}, function(err, users){
        if(users && users.length > 0) {
            user_plans = Array.from(users, usr=>usr.plans);
            console.log("!!!!! users: ", users);
            for (var i=0; i< users.length; i++) {
                var user = users[i];
                if(user.done) {
                    achieved.push({
                        "type": "plain_text",
                        "text": `*${Number(user.plans.get("focus_hours")).toFixed(2)} hours on ${user.plans.get("weekly_focus")}*`,
                        "emoji": true
                    });
                } else {
                    not_achieved.push({
                        "type": "plain_text",
                        "text": `*${Number(user.plans.get("hour_spent")).toFixed(2)}/${Number(user.plans.get("focus_hours")).toFixed(2)} hours on ${user.plans.get("weekly_focus")}*`,
                        "emoji": true
                    });
                }
            }
            message.push({
                "type": "section",
                "text": {
                "type": "mrkdwn",
                "text": ":smile:*What you have achieved last week*"
                }
            });
            message.push({
                "type": "divider"
            });
            if(achieved.length == 0 ){
                message.push({
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "_You have achieved nothing_"
                        }
                    }
                )
            } else {
                message.push({
                    "type": "section",
                    "fields": achieved
                })
            }
            
            message.push({
                "type": "section",
                "text": {
                "type": "mrkdwn",
                "text": ":cry:*Your remaining task for last week*"
                }
            });
            message.push({
                "type": "divider"
            });
            if(not_achieved.length == 0 ){
                message.push({
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "_You don't have any remaining tasks_"
                        }
                    }
                )
            } else {
                message.push({
                    "type": "section",
                    "fields": not_achieved
                })
            }
    
            bot.postMessage(slackID, "", {as_user:true, blocks:message});
        } else {
            bot.postMessage(slackID, "You don't set goals last week.", {as_user:true});
        }
        
        //console.log(user_plans);
    });
}

function weeklyReport(slackID, access_token){
    var lastweek = getMonday(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).toDateString(); //to test, I change 7 to 1
    var url = "https://www.rescuetime.com/api/oauth/daily_summary_feed?access_token="+access_token;
    WeeklyMultiPlan.find({slackID:slackID, week:lastweek}, function(err, users){
        if(users && users.length > 0) {
            var has_not_done = false;
            for(var i=0; i<users.length; i++) {
                var user = users[i];
                if(!user.done) {
                    has_not_done = true;             
                }
            }
            if(has_not_done) {
                axios.get(url).then(function(response){
                    var data = response.data[0];
                    dailyProgressEval(slackID, data, true);
                });
            } else {
                printWeeklyReport(slackID);
            }
        } else {
            bot.postMessage(slackID, "You don't set goals last week.", {as_user:true});
        }
    });
}

function printDailyReport(slackID, data, week=false, message){
    if(message == undefined) {
        message = [];
    }
    var daily_report = "The time you spent yesterday: \n";
    const features = {"software_development":"software_development_hours", "writing":"design_and_composition_hours", "learning":"reference_and_learning_hours"};
    /*
    for(var feature in features){
        daily_report += Number((data[features[feature]]).toFixed(2))+" hours on "+feature+",\n";
    }*/
    var lastweek = getMonday(new Date()).toDateString();
    WeeklyMultiPlan.findOne({slackID: slackID, week:lastweek, done:false}).exec(function(err, user){
        if(err) {
            console.log("an error has occurred");
        } else {
            if(user) {
                var goal = user.plans.get("weekly_focus");
                var hour=0;
                if(goal == 'Software Development') {
                    hour = Number((data['software_development_hours']).toFixed(2));
                } else if(goal == 'Writing more') {
                    hour = Number((data['design_and_composition_hours'])).toFixed(2);
                } else if(goal == 'Learning new things') {
                    hour = Number((data['reference_and_learning_hours']).toFixed(2));
                }
            
                daily_report = daily_report + `You spent *${hour} hours* on your weekly goal ${goal} yesterday.`;
                message.push({
                    "type": "section",
                    "text": {
                    "type": "mrkdwn",
                    "text": `${daily_report}`,
                    }
                });
                message.push({
                    "type": "divider"
                });
                // daily hours spent evaluation here
                //message.push(...eval);
                bot.postMessage(slackID, daily_report, {as_user:true, "blocks": message});
                
                dailyProgressEval(slackID, data, week);
            }
        }
    });
}
function dailyProgressEval(slackID, data, week) {
    var lastweek = getMonday(new Date()).toDateString();
    if(week) {
        lastweek = getMonday(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).toDateString();
    }
    console.log("$$$$$$ lastweek: ", lastweek);
    //var lastweek = getMonday(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).toDateString(); //!!! to test, I change 7 to 1
    WeeklyMultiPlan.findOne({slackID: slackID, week:lastweek, done:false}).exec(function(err, user){
        if(err){
            console.log(err);
        }else{
            if(!user) {
                bot.postMessage(slackID, "You don't have plans last week", {as_user:true});
                return;
            }
            var goal = user.plans.get("weekly_focus");

            var hour=0;
            if(goal == 'Software Development') {
                hour = Number((data['software_development_hours']).toFixed(2));
            } else if(goal == 'Writing more') {
                hour = Number((data['design_and_composition_hours'])).toFixed(2);
            } else if(goal == 'Learning new things') {
                hour = Number((data['reference_and_learning_hours']).toFixed(2));
            }
            //console.log("!!!! hour: ", hour);
            var curTotalHour = Number(hour) + Number(user.plans.get("hour_spent"));
            var targetHour = Number(user.plans.get("focus_hours"));

            var update = {};
            var text = ``;
            var imgUrl = "";
            var done = false;
            if(curTotalHour < targetHour) {
                update = {
                    $set: {
                      "plans": {
                        "weekly_focus": goal,
                        "focus_hours": targetHour,
                        "hour_spent": curTotalHour
                      }
                    }
                };
                text = `*${(targetHour-curTotalHour).toFixed(2)} hours left*. You almost there!! Don't give up!!`;
                imgUrl = getDailySupportGIF();
            } else {
                done = true;
                update = {
                    $set: {
                      "plans": {
                        "weekly_focus": goal,
                        "focus_hours": targetHour,
                        "hour_spent": curTotalHour
                      },
                      "done": true
                    }
                };
                text = `You finish ${goal}!! Well done!!`;
                imgUrl = getMadeItGIF();
            }
            var block_id = week? "weeklyReport":"dailyReminder";
            var val = [
                {
                    "type": "section",
                    "block_id": `${block_id}`,
                    "text": {
                        "type": "mrkdwn",
                        "text": `${text}`,
                    }
                },
                {
                    "type": "image",
                    "image_url": `${imgUrl}`,
                    "alt_text": "image1"
                }
            ]; 
            WeeklyMultiPlan.updateOne({slackID: slackID, week:lastweek, done:false}, update)
            .then(function(res){
                if(!week) {
                    if(done) {
                        val.push(...reactionMsg("How do you feel about ahieving your goal?"));
                    }
                    bot.postMessage(slackID, '', {as_user:true, "blocks": val});
                    if(done) {
                        setTimeout(function(){newPlan(user.slackID, "Good job! Set a new goal!");}, 800);
                    }
                } else {
                    printWeeklyReport(slackID);
                }
            })
            .catch(function(res){
                console.log("update value doesn't succeed: ", err);
            })
        }
        
    });

}
function dailyReport(slackID, week, plans){
    Apikey.findOne({slackID: slackID}).exec(function(err, user){
        if(err){
            console.log(err);
        }else{
            if(user){
                console.log("????????? ", user);
                var access_token = user.rescuetime_key;
                var weeklyPlan = printWeeklyPlan(slackID, plans, false);
                console.log("in daily report plans: ", plans);
                var message = [{
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "_*This is your daily reminder*_",
                    }}];
                message.push(...weeklyPlan);
                var url = "https://www.rescuetime.com/api/oauth/daily_summary_feed?access_token="+access_token;
                console.log("urlll: ", url);
                //var today = new Date(Date.now()- 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                //console.log("today, ", today);
                axios.get(url).then(function(response){
                    var data = response.data[0];
                    printDailyReport(slackID, data, false, message);
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
    startDailyReminder();
    startWeeklyPlanner();
    startDistractionCheck();
});


bot.on("message", message => {
    var slackID = message.user;
    if(message.type!='error'){
        console.log('-----------------');
        console.log(message);
        console.log("Timenow: "+(new Date()).toISOString());
        console.log("Timenow: "+(new Date()));
        console.log('-----------------');
    }
    const helpString = 'My features:\n\t'
        + 'Tell me *new plan* to set a new plan to work on for this week\n\t'
        + 'Tell me *focus* to focus on a specific task for the next few minutes\n\t'
        + 'Tell me *distraction* to keep you not distracted';
    switch (message.type) {
    case "message":
        if (message.channel[0] === "D" && message.bot_id === undefined) {
            Apikey.findOne({slackID: slackID}).exec(function(err, user){
                if(err){
                    console.log(err);
                } else {
                    //console.log(user);
                    if(!user){
                        //authenticate(slackID);
                        authenResuetime(slackID);
                    } else {
                        console.log("message,", message);
                        const addedFeatures = user.features;
                        if(message.text){
                            if(message.text.toLowerCase().includes('rescuetime')){
                                authenResuetime(slackID);
                            }else if(message.text.includes('distractionCheck')){
                                distractionCheck(slackID);
                            }else if(message.text.includes("Add feature new plan")){
                                if(addedFeatures.includes("new_plan")){
                                    bot.postMessage(message.user, "You have already added it! Tell me *new plan* to set plans!", {as_user:true});
                                }else{
                                    user.features.push("new_plan");
                                    user.save()
                                        .then(() => {
                                            console.log("Add feature new plan for ", slackID);
                                            bot.postMessage(message.user, "Successfully add new plan feature! Tell me *new plan* to set plans!", {as_user:true});
                                        })
                                        .catch((err) => {
                                            console.log("Failure Add feature new plan for " + slackID, err);
                                            bot.postMessage(message.user, "Failure! Please try again!", {as_user:true});
                                        });
                                }
                            }else if(message.text.includes("Add feature focus")){
                                if(addedFeatures.includes("focus")){
                                    bot.postMessage(message.user, "You have already added it! Tell me *focus* to focus!", {as_user:true});
                                }else{
                                    user.features.push("focus");
                                    user.save()
                                        .then(() => {
                                            console.log("Add feature focus for ", slackID);
                                            bot.postMessage(message.user, "Successfully add focus feature! Tell me *focus* to focus!", {as_user:true});
                                        })
                                        .catch((err) => {
                                            console.log("Failure Add feature focus for " + slackID, err);
                                            bot.postMessage(message.user, "Failure! Please try again!", {as_user:true});
                                        });
                                }
                            }else if(message.text.includes("distraction")){
                                if(addedFeatures.includes("distraction")){
                                    bot.postMessage(message.user, "You have already added it! I will remind you when you get distracted!", {as_user:true});
                                }else{
                                    if(message.text.includes("Add feature distraction")){
                                        user.features.push("distraction");
                                        user.save()
                                        .then(() => {
                                            console.log("Add feature distraction for ", slackID);
                                            bot.postMessage(message.user, "Successfully add distraction feature! I will remind you when you get distracted!", {as_user:true});
                                        })
                                        .catch((err) => {
                                            console.log("Failure Add feature distraction for " + slackID, err);
                                            bot.postMessage(message.user, "Failure! Please try again!", {as_user:true});
                                        });
                                    }else{
                                        bot.postMessage(message.user, "Tell me *Add feature distraction* to add this feature", {as_user:true});
                                    }
                                }
                            }else if(message.text.includes("weeklyPlanner")){
                                weeklyPlanner(slackID);
                            }else if(message.text.includes("dailyReminder")){
                                dailyReminder(slackID);
                            }else if(message.text.includes("new plan")) {
                                if(addedFeatures.includes("new_plan")){
                                    newPlan(slackID);
                                }else{
                                    bot.postMessage(message.user, "Tell me *Add feature new plan* to add this feature", {as_user:true});
                                }
                            }
                            else if(message.text.includes("focus")) {
                                if(addedFeatures.includes("focus")){
                                    shortFocus(slackID);
                                }else{
                                    bot.postMessage(message.user, "Tell me *Add feature focus* to add this feature", {as_user:true});
                                }
                            }else if(message.text.includes("I want to spend")) {
                                setShortFocus(slackID, message);
                            }else if(message.text.includes("quickReaction")) {
                                quickReactionTest(bot, slackID);
                            }else{
                                bot.postMessage(message.user, helpString, {as_user:true});
                            }
                        }
                    }
                }
            });
        }
        break;
    }
    
});

function checkShortFocus(slackID) {
    Apikey.findOne({slackID: slackID}).exec(function(err, user){
        if(err) {
            console.log("an error occured");
        } else {
            if(user) {
                var rescuetimeKey = user.rescuetime_key;
                if(rescuetimeKey) {
                    ShortFocus.findOne({slackID:slackID, done:false}).exec(function(err, user){
                        if(user) {
                            var target = user.rescueTimeStart.get("target");
                            var startSecs = Number(user.rescueTimeStart.get("secs"));
                            var targetSecs = Number(user.plans.get("num"))*60;
                            var url = "https://www.rescuetime.com/api/oauth/data";
                            var secs = 0;
                            var d = new Date();
                            axios.get(url, {
                                params: {
                                  access_token: rescuetimeKey,
                                  restrict_begin: d.toISOString(),
                                  restrict_end: d.toISOString(),
                                  format: 'json' 
                                }
                              })
                            .then(function(res){
                                var data = res.data;    
                                for(var i=0; i<data.rows.length; i++) {
                                    if(data.rows[i][4] == target) {
                                        console.log("?????? "+data.rows[i][3]+" "+data.rows[i][4]+" and seconds: "+data.rows[i][1]);
                                        secs += Number(data.rows[i][1]);
                                    }
                                }
                                var diff = secs - startSecs;
                                var message = [{
                                    "type": "section",
                                    "block_id": "shortFocus",
                                    "text": {
                                        "type": "mrkdwn",
                                        "text": "_*Short Focus*_"
                                    }
                                }, {
                                    "type": "divider"
                                }];
                                if(diff >= targetSecs) {
                                    message.push({
                                        "type": "section",
                                        "text": {
                                            "type": "mrkdwn",
                                            "text": `Congrats! You decide to spend *${user.plans.get("num")} minutes* on *${user.plans.get("activity")}* and you did it!:smile:`
                                        }
                                    });
                                    //var msg = `Congrats! You decide to spend *${user.plans.get("num")} minutes* on *${user.plans.get("activity")}* and you did it!:smile:`;
                                    //bot.postMessage(slackID, msg, {as_user:true});
                                    //bot.postMessage(slackID, "", {as_user:true, blocks:message});
                                } else {
                                    message.push({
                                        "type": "section",
                                        "text": {
                                            "type": "mrkdwn",
                                            "text": `Oops! You decide to spend *${user.plans.get("num")} minutes* on *${user.plans.get("activity")}* and it seems you didn't focus too much on it:cry:`
                                        }
                                    });
                                    //var msg = `Oops! You decide to spend *${user.plans.get("num")} minutes* on *${user.plans.get("activity")}* and it seems you didn't focus too much on it:cry:`;
                                    //bot.postMessage(slackID, msg, {as_user:true});
                                }
                                var reaction = reactionMsg("How do you feel after short focus?");
                                message.push(...reaction);
                                bot.postMessage(slackID, "", {as_user:true, blocks:message});

                                var update = {
                                    $set: {
                                      "done": true
                                    }
                                };
                                ShortFocus.updateOne({slackID: slackID, done:false}, update)
                                .then(function(res){
                                    console.log("!!!!! update success");
                                })
                                .catch(function(err){
                                    console.log("!!!! an update error occured");
                                })
                            })
                            .catch(function(err){
                                console.log("an error occured");
                            });
                        }
                    });
                } else {
                    bot.postMessage(slackID, "You didn't set up your RescueTime key!", {as_user:true});
                    authenResuetime(slackID);
                }
            } else {
                bot.postMessage(slackID, "You didn't add your api key!", {as_user:true});
            }
        }
    });
}
function setShortFocus(slackID, message) {
    console.log("!!!!! message: ", message);
    var r = /\d+/;
    var msg = message.text;
    var match = msg.match(r);
    
    console.log(Math.floor(new Date(Date.now()+1 * 1 * 2 * 60 * 1000).getTime() / 1000));
    if(match != null) {
        var num = Number(match[0]);
        var activity = "";
        var target = "";
        if(msg.includes("Software Development") || msg.includes("software development")) {
            activity = "Software Development";
            target = "General Software Development";
        } else if(msg.includes("Write More") || msg.includes("write more")) {
            activity = "Write More";
            target = "Writing"
        } else if(msg.includes("Learn new things") || msg.includes("learn new things")) {
            activity = "Learn new things";
            target = "General Reference & Learning";
        }
        
        if(activity.length==0) {
            bot.postMessage(slackID, "no activity found. Write again.", {as_user:true});
        } else {
            console.log(`you want to spend ${num} minutes on ${activity}`);
            
            Apikey.findOne({slackID: slackID}).exec(function(err, user){
                if(err){
                    console.log(err);
                }else{
                    if(user) {
                        var rescuetimeKey = user.rescuetime_key;
                        var secs = 0;
                        if(rescuetimeKey) {
                            var url = "https://www.rescuetime.com/api/oauth/data"; 
                            var d = new Date();
                            axios.get(url, {
                                params: {
                                  access_token: rescuetimeKey,
                                  restrict_begin: d.toISOString(),
                                  restrict_end: d.toISOString(),
                                  format: 'json' 
                                }
                              })
                              .then(function (response) {
                                ShortFocus.findOne({slackID:slackID, done:false}).exec(function(err, user){
                                    if(err){
                                        console.log("an error occured");
                                    } else {
                                        if(user) {
                                            var msg = `You haven't finished your ${user.plans.get("num")} minutes on ${user.plans.get("activity")} yet!`;
                                            bot.postMessage(slackID, msg, {as_user:true});
                                        } else {
                                            var data = response.data;    
                                            for(var i=0; i<data.rows.length; i++) {
                                                if(data.rows[i][4] == target) {
                                                    console.log("!!!!!!! "+data.rows[i][3]+" "+data.rows[i][4]+" and seconds: "+data.rows[i][1]);
                                                    secs += Number(data.rows[i][1]);
                                                }   
                                            }
                                            
                                            var plan = [["activity", activity], ["num", num]];
                                            var rescuetimeStart = [["target", target], ["secs", secs]];
                                
                                            var newWShortFocus = new ShortFocus({
                                                slackID: slackID,
                                                plans: plan,
                                                rescueTimeStart: rescuetimeStart,
                                                done: false,
                                            });
                                            console.log("!!!!!! newShorFocus: ", newWShortFocus);
                                            newWShortFocus.save()
                                            .then(() => {
                                                bot.postMessage(slackID, `Great! Focus ${num} minutes on ${activity}. I will remind you later :smile:`, {as_user:true});
                                                setTimeout(function(){checkShortFocus(slackID);}, Number(num)*60*1000);
                                            })
                                                .catch((err) => {
                                                    console.log(err);
                                                    bot.postMessage(slackID, "Ooops!!! Error occurs! Please try again", {as_user:true});
                                                })
                                        }
                                    }
                                });
                              })
                              .catch(function (error) {
                                console.log("get rescuetime data error: ", error);
                              });
                        } else {
                            bot.postMessage(slackID, "You didn't set up your RescueTime key!", {as_user:true});
                            authenResuetime(slackID);
                        }
                    } else {
                        bot.postMessage(slackID, "You didn't add your api key!", {as_user:true});
                    }
                }
            });
            
        }
    } else {
        bot.postMessage(slackID, "no number found. Write again.", {as_user:true});
    }
}

function authenResuetime(slackID){
    console.log("enter authenResuetime");
    Apikey.findOne({slackID: slackID}).exec(function(err, user){
        if(err){
            console.log(err);
        } else {
            //console.log(user);
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

function authenSlack(slackID){
    console.log("enter authenSlack");
    SlackKey.findOne({slackID: slackID}).exec(function(err, user){
        if(err){
            console.log(err);
        } else {
            //console.log(user);
            if(!user){
                bot.postMessage(slackID, 'Please click the following button to add Slack as a data source.' , {
                    as_user:true,
                    "attachments": [
                        {
                            "fallback": "activate",
                            "actions": [
                                {
                                    "type": "button",
                                    "text": "connect",
                                    "url": process.env.DOMAIN + '/apikey/slack/oauth?auth_id='+slackID
                                }
                            ]
                        }
                    ]
                });
            }else{
                bot.postMessage(slackID,"Congratulations! You successfully add slack.",{as_user: true});
            }
        }
    });
}

function requestResuetime(slackID){
    Apikey.findOne({slackID: slackID}).exec(function(err, user){
        if(err){
            console.log(err);
        } else {
            //console.log(user);
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

function shortFocus(slackID) {
    var msg = [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "Choose what you want to focus for the next few minutes"
            },
            "accessory": {
                "type": "static_select",
                "placeholder": {
                    "type": "plain_text",
                    "text": "Choose an activity",
                    "emoji": true
                },
                "options": [
                    {
                        "text": {
                            "type": "plain_text",
                            "text": "Software Development",
                            "emoji": true
                        },
                        "value": "value-0"
                    },
                    {
                        "text": {
                            "type": "plain_text",
                            "text": "Write More",
                            "emoji": true
                        },
                        "value": "value-1"
                    },
                    {
                        "text": {
                            "type": "plain_text",
                            "text": "Learn new things",
                            "emoji": true
                        },
                        "value": "value-2"
                    }
                ]
            }
        }
    ];
    bot.postMessage(slackID, "", {as_user:true, blocks:msg});    
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
    getMonday: getMonday
}
