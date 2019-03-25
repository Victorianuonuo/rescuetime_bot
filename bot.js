var SlackBot = require('slackbots');
var mongoose = require('mongoose');
//mongoose.connect(process.env.MONGODB_URI,{ useNewUrlParser: true }); // only when test bot.js
const {google} = require('googleapis');
var {User, Apikey, ConfigUser, WeeklyPlan, SlackKey, WeeklyMultiPlan, ShortFocus, ShareLink} = require('./models/models');
var _ = require('underscore')
var googleAuth = require('google-auth-library');
var CronJob = require('cron').CronJob;
var Config = require('./config');
var axios = require('axios');
var is_greet = false;
var {startDialog} = require('./routes/common');
const envKey = process.env.NUDGE_BOT_TOKEN;
var superagent = require('superagent');
var mammoth = require('mammoth');
var word_count = require('word-count');
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

const startShareLinksDaily = function(){
    var job = new CronJob({
        cronTime: '00 30 00 * * *',
        onTick: function() {
            console.log('startShareLinksDaily tick!');
            shareLinksCheck();
        }
    });
    job.start();
}

const startShareLinksDailyReport = function(){
    var job = new CronJob({
        cronTime: '00 15 07 * * *',
        onTick: function() {
            console.log('startShareLinksDailyReport tick!');
            shareLinksDailyReport();
        }
    });
    job.start();
}

function shareLinksDailyReport(trigger=null){
    ShareLink.find({}, function(err, users) {
        if(err){
            console.log(err);
        }else{
            users.forEach(function(user) {
                if(!trigger || trigger==user.slackID){
                    console.log("shareLinksDailyReport for ", user);
                    shareLinksDailyReport_users(user);
                }
            });
        }
    });
}

function shareLinksDaily(trigger=null){
    ShareLink.find({}, function(err, users) {
        if(err){
            console.log(err);
        }else{
            users.forEach(function(user) {
                if(!trigger || trigger==user.slackID){
                    console.log("shareLinksCheck for ", user);
                    shareLinksDaily_users(user);
                }
            });
        }
    });
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
    Apikey.find({}, function(err, users) {
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
                imgUrl = "https://media.giphy.com/media/12XDYvMJNcmLgQ/giphy.gif";
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
                imgUrl = "https://media.giphy.com/media/1ZDCyTHjA4fYYKJPRx/giphy.gif";
            }
            var val = [
                {
                    "type": "section",
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
    for (var i = 0; i <= 23; i++) {
        var is_print=false;
        if(i==7)
          is_print=true;
        startCronJob(("00" + i).slice(-2),is_print);
    }
    startDailyReminder();
    startWeeklyPlanner();
    startShareLinksDailyReport();
    startShareLinksDaily();
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
    var slackID = message.user;
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
                    //console.log(user);
                    if(!user){
                        authenticate(slackID);
                    } else {
                        console.log("message,", message);
                        if(message.text){
                            if(message.text.toLowerCase().includes('calendar')){
                                oneTimeCheck(user, true);
                            }else if(message.text.toLowerCase().includes('rescuetime')){
                                authenResuetime(slackID);
                                //requestResuetime(slackID);
                            }else if(message.text.includes("weeklyPlanner")){
                                weeklyPlanner(slackID);
                                //dailyReminder();
                            }else if(message.text.includes("dailyReminder")){
                                //weeklyPlanner();
                                dailyReminder(slackID);
                            }else if(message.text.includes("newPlan")) {
                                newPlan(slackID);
                            }else if(message.text.includes("slack")){
                                authenSlack(slackID);
                            }else if(message.text.includes("focus")) {
                                shortFocus(slackID);
                                //checkShortFocus(slackID);
                            }else if(message.text.includes("I want to spend")) {
                                setShortFocus(slackID, message);
                            }else if(message.text.includes("I want to write more")){
                                getShareLink(slackID);
                            }else if(message.text.includes("remove")){
                                removeShareLink(slackID, message.text);
                            }else if(message.text.includes("docs.google.com")||message.text.includes("www.dropbox.com")){
                                storeShareLink(slackID, message.text);
                            }else if(message.text.includes("shareLinksDailyReport")){
                                shareLinksDailyReport(slackID);
                            }else if(message.text.includes("shareLinksDaily")){
                                shareLinksDaily(slackID);
                            }else{
                                bot.postMessage(message.user, MESSAGE, {as_user:true});
                            }
                        }
                    }
                }
            });
        }
        break;
    }
    
});

function removeShareLink(slackID, msg){
    console.log(msg.split(" "));
    const links = msg.split(" ");
    var link = links[links.length-1];
    if(link.startsWith("<")&&link.endsWith(">")){
        link = link.substring(1, link.length-1);
        console.log("removeShareLink", slackID, link);
    }
    console.log("removeShareLink,", link);
    ShareLink.findOne({slackID:slackID}).exec(function(err, user){
        if(err){
            console.log(err);
        }else{
            if(user){
                if(user.original_links.includes(link)){
                    var idx = user.original_links.indexOf(link);
                    user.links.splice(idx, 1);
                    user.original_links.splice(idx, 1);
                    user.progresses.splice(idx, 1);
                    user.numbers.splice(idx, 1);
                    user.isDocxs.splice(idx, 1);
                    user.save().then(()=>{
                        bot.postMessage(slackID, "successfully remove the link!", {as_user:true});
                    }).catch(err=>{
                        bot.postMessage(slackID, "Something wrong when remove the link! Please try again later!", {as_user:true});
                        console.log("removeShareLink save error", err);
                    });
                }else{
                    bot.postMessage(slackID, "Ooops! You haven't added the link so you cannot remove it.", {as_user:true});
                }
            }else{
                bot.postMessage(slackID, "Ooops! You haven't added the link so you cannot remove it.", {as_user:true});
            }

        }
    });
}

function shareLinksDaily_users(user){

    var all_count_words = user.links.map(function(link, i){
        return countWord(user.links[i], user.isDocxs[i]).then(function(number){
            console.log("countWord", user.links[i]+" ", user.isDocxs[i]+" ", user.numbers[i]+" ", number+" ");
            user.progresses[i] = parseInt(number, 10) - parseInt(user.numbers[i], 10);
            user.numbers[i] = number;
        });
    });

    Promise.all(all_count_words).then(data=>{
        console.log("shareLinksDaily_users,,",user);
        console.log(data);
        user.markModified("progresses");
        user.markModified("numbers");
        user.save()
            .then(() => {
                console.log("shareLinksDaily_users successfully save ",user);
            })
            .catch((err) => {
                console.log("newShareLink save error", err, user.slackID);
            });
    });
}

function shareLinksDailyReport_users(user){
    var message = user.progresses.map(function(progress, idx){
        return user.original_links[idx]+" "+progress;
    });
    bot.postMessage(user.slackID, "Your progress on your writing yesterday:\n"+message.join("\n"), {as_user: true});
}

async function countWord(url, isDocx){
    const response = await superagent.get(url)
                                     .parse(superagent.parse.image)
                                     .buffer();
    var buffer = response.body;
    var text;
    if(isDocx){
        text = (await mammoth.extractRawText({ buffer })).value;
    }else{
        text = buffer.toString('utf8');
    }
    console.log(url, isDocx, word_count(text));
    return word_count(text);
}

function addShareLink(slackID, link, msg, isDocx){
    console.log("addShareLink", slackID, link, isDocx);
    ShareLink.findOne({slackID:slackID}).exec(function(err, user){
        if(err){
            console.log(err);
        }else{
            if(user){
                var newShareLink = user;
            }else{
                var newShareLink = new ShareLink({
                    slackID: slackID
                });
            }
            if(newShareLink.links.includes(link)){
                bot.postMessage(slackID, "Links already exists!", {as_user:true});
            }else{
                countWord(link, isDocx).then(function(number){
                    newShareLink.links.push(link);
                    newShareLink.numbers.push(number);
                    newShareLink.isDocxs.push(isDocx);
                    newShareLink.progresses.push(0);
                    newShareLink.original_links.push(msg);
                    newShareLink.save()
                                .then(() => {
                                    bot.postMessage(slackID, "You've got "+number+" words now, keep writing! Will notify you about your progress every day!\nIf you don't want me to keep track of the doc, just type remove "+msg, {as_user:true});
                                })
                                .catch((err) => {
                                    console.log("newShareLink save erro", err);
                                    bot.postMessage(slackID, "Sorry! Couldn't read the link. Try again and make sure you paste all the link! If it still couldn't work, try to contact the researchers!", {as_user:true});
                                })
                }).catch(function(error){
                    console.log("countWord error", error);
                    bot.postMessage(slackID, "Sorry! Couldn't read the link. Try again and make sure you paste all the link! If it still couldn't work, try to contact the researchers!", {as_user:true});
                });
            }
        }
    });
}

function storeShareLink(slackID, msg){
    console.log("storeShareLink", slackID, msg);
    if(msg.startsWith("<")&&msg.endsWith(">")){
        msg = msg.substring(1, msg.length-1);
        console.log("storeShareLink", slackID, msg);
    }
    if(msg.includes("docs.google.com")){
        var indexOf = msg.indexOf('/edit?usp=sharing');
        var link = msg.substring(0,indexOf)+'/export?hl=en&exportFormat=txt';
        addShareLink(slackID, link, msg, false);
    }else if(msg.endsWith(".txt?dl=0")){
        var link = msg.substring(0, msg.length-1)+'1';
        addShareLink(slackID, link, msg, false);
    }else if(msg.endsWith(".docx?dl=0")){
        var link = msg.substring(0, msg.length-1)+'1';
        addShareLink(slackID, link, msg, true);
    }else{
        console.log("match failed", msg);
        bot.postMessage(slackID, "Sorry! Couldn't read the link. Try again and make sure you paste all the link! If it still couldn't work, try to contact the researchers!", {as_user:true});
    }
}

function displayShareLink(slackID){
    ShareLink.findOne({slackID:slackID}).exec(function(err, user){
        if(err){
            console.log(err);
        }else{
            //console.log("displayShareLink", user);
            if(user&&user.links.length>0){
                bot.postMessage(slackID, "You have set the following links!\n"+user.original_links.join("\n"), {as_user:true});  
            }else{
                bot.postMessage(slackID, "You haven't set any share links yet!", {as_user:true});  
            }
        }
    });
}

function getShareLink(slackID){
    displayShareLink(slackID);
    bot.postMessage(slackID, "Send the share link to me which grants view access to everyone with the link if you want to add to the share docs I monitor", {as_user:true});
}

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
                                console.log("$$$$$$ diff: ", diff);
                                if(diff >= targetSecs) {
                                    var msg = `Congrats! You decide to spend *${user.plans.get("num")} minutes* on *${user.plans.get("activity")}* and you did it!:smile:`;
                                    bot.postMessage(slackID, msg, {as_user:true});
                                } else {
                                    var msg = `Oops! You decide to spend *${user.plans.get("num")} minutes* on *${user.plans.get("activity")}* and it seems you didn't focus too much on it:cry:`;
                                    bot.postMessage(slackID, msg, {as_user:true});
                                }
                                
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
    console.log("token: ", bot.token);
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
                    "url": process.env.DOMAIN + '/apikey/googlecalendar/oauth?auth_id='+slackID
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
        process.env.DOMAIN + '/apikey/googlecalendar/connect/callback'
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
        //console.log(events);
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

function authenSlack(slackID){
    console.log("enter authenSlack");
    SlackKey.findOne({slackID: slackID}).exec(function(err, user){
        if(err){
            console.log(err);
        } else {
            console.log(user);
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
