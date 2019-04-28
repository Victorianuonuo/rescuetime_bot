var axios = require('axios');
var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');
//mongoose.connect(process.env.MONGODB_URI,{ useNewUrlParser: true }); 
var {User, Apikey, ConfigUser, WeeklyPlan, WeeklyMultiPlan, DistractionsDelay} = require('../models/models');
var {bot, getMonday, authenResuetime} = require('../bot');
var {verifyJson} = require('./common');
var passport = require('passport');
const {google} = require('googleapis');
var googleAuth = require('google-auth-library');
var CLIENT_ID = process.env.CLIENT_ID;
var CLIENT_SECRET = process.env.CLIENT_SECRET;
var {updateMessage} = require('../quickReaction');
var {startDialog} = require('./common');
var moment = require('moment');
var {setShortFocus} = require('../focus/shortFocus');

router.get('/googlecalendar/oauth', function(req, res){
    var oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.DOMAIN + '/apikey/googlecalendar/connect/callback'
    )
    var url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: [
            'https://www.googleapis.com/auth/userinfo.profile',
            'email',
            'https://www.googleapis.com/auth/calendar.readonly'
        ],
        state: encodeURIComponent(JSON.stringify({
            auth_id: req.query.auth_id
        }))
    });
    var slackID = req.query.auth_id;
    res.redirect(url);
})

router.get('/googlecalendar/connect/callback', function(req, res) {
    const code = req.query.code;
    var slackID = JSON.parse(decodeURIComponent(req.query.state)).auth_id;
    //console.log("google calendar req.query.state slackID", JSON.parse(decodeURIComponent(req.query.state)), slackID);
    var oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.DOMAIN + '/apikey/googlecalendar/connect/callback'
    )
    //console.log("this is oauth", oauth2Client);
    oauth2Client.getToken(code, function (err, tokens) {
        if(err) {
            console.log(err);
        } else {
            //set credentials. not entirely sure what this does but necessary for google plus
            //when a person gives access to their google calendar, we also make a request to google plus
            //with their oauth2client in order to get their email address which is then saved in the user object
            //in mongodb.
            oauth2Client.setCredentials(tokens);
            //console.log("this is tokens", tokens);
            var plus = google.plus('v1');
            plus.people.get({auth: oauth2Client, userId: 'me'}, function(err, person){
                if(err){
                    console.log(err);
                } else {
                    //when a person
                    console.log("this is googleplus person object", person);
                    var tempEmail = person.data.emails[0].value;
                    let auth_id = JSON.parse(decodeURIComponent(req.query.state));
                    var newUser = new User({
                        token: tokens,
                        slackID: slackID,
                        auth_id: auth_id.auth_id,
                        email: tempEmail
                    });
                    newUser.save()
                    .then( () => {
                        res.status(200).send("Your account was successfuly authenticated");
                        bot.postMessage(slackID, "Congratulations! You are successfully connected to google calendar. Reminders for every day's events will come in at 7 am.", {as_user:true});
                        setTimeout(authenResuetime(slackID), 1000);
                    })
                    .catch((err) => {
                        console.log(err.errmsg);
                        console.log('error in newuser save of connectcallback');
                        res.status(400).json({error:err});
                        bot.postMessage(slackID, "Ooops!!! Error occurs! Please try again by saying Hi to me!", {as_user:true});
                    })
                }
            });
        }
    });
})

router.get('/rescuetime/oauth', function(req, res, next) {
    var slackID = req.query.auth_id;
    passport.authenticate('rescuetime', {state: slackID})(req, res, next);
});

router.get('/rescuetime/callback',
  passport.authenticate('rescuetime', { failureRedirect: '/apikey/rescuetime/callback', session: false }),
  function(req, res) {
    var slackID = req.query.state;
    console.log("/rescuetime/callback slackID req.query", slackID, req.query);
    // Successful authentication, redirect home.
    if(slackID){
        console.log("Successful rescuetime button connection.");
        bot.postMessage(slackID, "Congratulations! You successfully add rescuetime.", {as_user:true});
        res.status(200).send("Your account was successfully authenticated");
    }else{
        console.log("Error in rescuetime button connection, missing slackID ", slackID);
        bot.postMessage(slackID, "Ooops! Something went wrong! Please try again!", {as_user:true});
        res.status(400).send("Your slackID is missing when call back!");
    }
  });

router.get('/slack/oauth', function(req, res, next) {
    var slackID = req.query.auth_id;
    passport.authenticate('Slack', {state: slackID})(req, res, next);
});

router.get('/slack/callback',
  passport.authenticate('Slack', { failureRedirect: '/apikey/slack/callback', session: false }),
  function(req, res) {
    var slackID = req.query.state;
    console.log("/slack/callback slackID req.query", slackID, req.query);
    // Successful authentication, redirect home.
    if(slackID){
        console.log("Successful slack button connection.");
        bot.postMessage(slackID, "Congratulations! You successfully add slack.", {as_user:true});
        res.status(200).send("Your account was successfully authenticated");
    }else{
        console.log("Error in slack button connection, missing slackID ", slackID);
        bot.postMessage(slackID, "Ooops! Something went wrong! Please try again!", {as_user:true});
        res.status(400).send("Your slackID is missing when call back!");
    }
  });

router.post('/', async function(req, res){
    var data = JSON.parse(req.body.payload);
    var slackID = data.user.id;
    console.log("post apikey:", data);
    if(data.type=="dialog_submission" && data.callback_id=="rescuetime_callback"){
        var token = data.submission.apikey;
        console.log("token: ", token);
        var newApikey = new Apikey({
                        slackID: slackID,
                        rescuetime_key: token,
                    });
        var url = "https://www.rescuetime.com/anapi/alerts_feed?key="+token;
        console.log("urlll: ", url);
        axios.get(url).then(function(response){
            console.log(response.data);
            newApikey.save()
            .then( () => {
                res.send();
                bot.postMessage(slackID, "Congratulations! You successfully add rescuetime.", {as_user:true});
                })
            .catch((err) => {
                console.log('error in new rescuetime api');
                console.log(err.errmsg);
                if(err.errmsg.includes("duplicate key")){
                    res.status(400).json({error:err});
                    bot.postMessage(slackID, "Ooops!!! You have already submitted your rescuetime api key!", {as_user:true});
                }else{
                    res.status(400).json({error:err});
                    bot.postMessage(slackID, "Ooops!!! Error occurs! Please try again by saying rescuetime to me!", {as_user:true});
                }
            });
            res.send();
        }).catch(function(error) {
            console.log("error");
            res.status(200).json({"errors":[{"name": "apikey", "error": "Ooops!!! Invalid key. Please try agin by saying rescuetime to me and input the right key"}]});
            console.log("e23r");
        });
    }else if(data.type=="dialog_submission"){
        if(data.callback_id=="config_callback"){
            var submission = data.submission;
            console.log("submission: ", submission);
            var configkey = process.env.configkey || 233;
            if(submission.key!=configkey){
                res.status(200).json({"errors":[{"name": "key", "error": "Ooops!!! Invalid key. Please input the right key to change the config file"}]});
                return;
            }
            var is_user = submission.slackID=='all';
            if(!is_user){
                console.log("slackID,", submission.slackID);
                var users = await bot.getUsers();
                var user_ids = Array.from(users.members, usr=>usr.id);
                console.log(user_ids);
                if(user_ids.includes(submission.slackID)){
                    console.log("slackID in,", submission.slackID);
                    is_user = true;
                }
                console.log("is_user, ", is_user);
                if(!is_user){
                    res.status(200).json({"errors":[{"name": "slackID", "error": "Ooops!!! Invalid slackID. Please input the right slackID or all for all users to change the config file"}]});
                    return;
                }
            }
            var verification = verifyJson(submission.configfile);
            if(verification.errors){
                res.status(200).json({"errors":[{"name": "configfile", "error": verification.errors}]});
                return;
            }

            ConfigUser.findOne({slackID: submission.slackID}).exec(function(err, user){
                if(err){
                    console.log(err);
                } else {
                    console.log(user);
                    if(user){
                        console.log("ConfigUser slackID"+ user.slackID+" exist, set by ", user.auth_id);
                        var newConfigFile = user;
                        newConfigFile.configJson = submission.configfile;
                        newConfigFile.auth_id = submission.slackID;
                    }else{
                        var newConfigFile = new ConfigUser({
                            slackID: submission.slackID,
                            configJson: submission.configfile,
                            auth_id: slackID
                        });
                    }
                    newConfigFile.save()
                    .then( () => {
                        bot.postMessage(slackID, "Congratulations! You successfully change configfile for "+submission.slackID, {as_user:true});
                        })
                    .catch((err) => {
                        console.log('error in new newConfigFile api');
                        console.log(err.errmsg);
                        bot.postMessage(slackID, "Ooops!!! Error occurs! Please try again by type slack command config", {as_user:true});
                    });
                    res.send();
                }
            });
        }else if(data.callback_id=="newplan_callback"){
            var submission = data.submission;
            if(isNaN(submission["focus_hours"]) || isNaN(parseFloat(submission["focus_hours"]))) {
                console.log("!!!! input hours not numeric: ", submission);
                res.type('application/json');
                var errorMsg = {
                    "errors": [
                        {"name": "focus_hours", "error": "This should only be numeric"}
                    ]
                }
                res.status(200).send(errorMsg);
            } else {
            submission["hour_spent"] = 0; //record how long the user has already spent on
            //console.log("submission: ", submission);
            var week = getMonday(new Date()).toDateString();
            var newWeeklyMultiPlan = new WeeklyMultiPlan({
                slackID: slackID,
                week: week,
                plans: submission,
                done: false
            });
            newWeeklyMultiPlan.save()
                .then(() => {
                    bot.postMessage(slackID, `Great! You've set a goal to spend ${submission.focus_hours} hours on ${submission.weekly_focus}. I will keep you on track :smile:`, {as_user:true});
                })
                .catch((err) => {
                    bot.postMessage(slackID, "Ooops!!! Error occurs! Please try again saying weeklyplan", {as_user:true});
                })
            res.send();
            }
        }
    } else if(data.type == "dialog_cancellation") {
        console.log("!!!!! user has cancel the dialog!!");
        console.log(data);
    } else if(data.type == "block_actions") {
        if(data.actions[0].placeholder && data.actions[0].placeholder.text == "Choose an activity") {
            var activity = data.actions[0].selected_option.text.text;
            var msg = [
                {
                    "type": "divider"
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `Tell me how long you want to spend on *${activity}*`
                    }
                },
                {
                    "type": "actions",
                    "block_id": "shortFocusTime",
                    "elements": [
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "30 Minutes :clock1:",
                                "emoji": true
                            },
                            "value": `30 ${activity}`
                        },
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "1 Hour :clock2:",
                                "emoji": true
                            },
                            "value": `60 ${activity}`
                        },
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "90 Minutes :clock3:",
                                "emoji": true
                            },
                            "value": `90 ${activity}`
                        },
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "2 Hours :clock4:",
                                "emoji": true
                            },
                            "value": `120 ${activity}`
                        }
                    ]
                }
            ];
            bot.postMessage(slackID, '', {as_user:true, blocks:msg});
            //bot.postMessage(slackID, `Tell me how long you want to spend on ${activity}? \n Say *I want to spend XX minutes on ${activity}* to me`, {as_user:true});
        }
        else if(data.actions[0].value && data.actions[0].value=="quick_reaction") {
            updateMessage(bot, data);
        }
        else if(data.actions[0] && data.actions[0].block_id=="shortFocusTime") {
            //console.log("!!!!!!! ", data.actions[0].value);
            setShortFocus(bot, data); 
        }
        res.send();
    }
    else if(data.type == "interactive_message"){
        if(data.actions[0].name == "rescuetime_api_key_yes"){
            Apikey.findOne({slackID: slackID}).exec(function(err, apikey){
                if(err){
                    console.log(err);
                } else {
                    console.log(apikey);
                    if(!apikey){
                        var requestData = {
                            "trigger_id": data.trigger_id,
                            "dialog": {
                                "callback_id": "rescuetime_callback",
                                "title": "Request a rescuetime api",
                                        "submit_label": "Request",
                                        "notify_on_cancel": true,
                                        "state": "Limo",
                                        "elements": [
                                        {
                                            "label": "Your rescuetime API key",
                                            "name": "apikey",
                                            "type": "text",
                                            "placeholder": "Your rescuetime API key"
                                        },
                                        ],
                                    },
                        };
                        startDialog(requestData);
                    } else {
                        bot.postMessage(slackID, "Ooops!!! You have already submitted your rescuetime api key!", {as_user:true});
                        //res.send("Ooops!!! You have already submitted your rescuetime api key!");
                    }
                }
            });
        }else if(data.actions[0].name == "rescuetime_api_key_no"){
            bot.postMessage(slackID, "So sorry that you said no to add rescuetime. Maybe you would change your mind later.", {as_user:true});
            //res.send("So sorry that you said no to add rescuetime. Maybe you would change your mind later. When you are ready, try agin by saying rescuetime to me and input the right key.");
        }else if(["distraction_delay_30", "distraction_delay_60", "distraction_delay_90", "distraction_delay_120", "distraction_delay_later"].includes(data.actions[0].name)){
            var value = Number(data.actions[0].value);
            var d = new Date();
            //var date = d.toISOString().split('T')[0];
            var date = moment().format().split('T')[0];
            var ts = new Date(data.message_ts * 1000).toISOString().split('T')[0];
            console.log("date ts d message_ts", date, ts, d, data.message_ts);
            if(true){
                DistractionsDelay.findOne({slackID:slackID, date:date}).exec(function(err, user){
                    if(user&&Number(data.message_ts)>=user.ts){
                        if(value>0){
                            user.time_left += value*60;
                            user.ts = Math.round(new Date().getTime()/1000);
                            user.save()
                            .then(() => {
                                console.log("newDistractionsDelay user save for ", slackID);
                                console.log(user);
                                bot.postMessage(slackID, "Ok! You can spend "+value+" minutes more on distractions.", {as_user:true});
                            })
                            .catch((err) => {
                                console.log("newDistractionsDelay user save for "+slackID, err);
                                bot.postMessage(slackID, "Ooops! Something wrong with button! Please try again later!", {as_user:true});
                            });
                        }else{
                            bot.postMessage(slackID, "Ok! I will reminde you 30 minutes later!", {as_user:true});
                        }
                    }else{
                        console.log("update value failed in distraction_delay user message_ts", user, data.message_ts);
                        if(user){
                            bot.postMessage(slackID, "Ooops! Don't click on the previous button!", {as_user:true});
                        }
                    }
                });
            }
            // else{
            //     console.log("not equal date ts", date, ts, d, data.message_ts);
            //     bot.postMessage(slackID, "Ooops! Don't click on the previous button!", {as_user:true});
            // }
        }else if(data.actions[0].name == "new_plan_button"){
            var week = getMonday(new Date()).toDateString();
            
            WeeklyMultiPlan.findOne({slackID: slackID, week: week, done:false}).exec(function(err, user){
                if(err){
                    console.log(err);
                } else {
                    if(user) {
                        bot.postMessage(slackID, "you haven't finished your last focus yet! Can't set new!", {as_user: true});
                        res.send();
                    } else {
                        var hourOptions = [];
                        var focuses = [
                            {"label": "Software Development", "value": "Software Development"},
                            {"label": "Writing more", "value": "Writing more"},
                            {"label": "Learning new things", "value": "Learning new things"}];
                        for (var i = 30; i >= 0; i-=2) {
                            hourOptions.push({"label":i.toString(), "value":i.toString()});
                        }
                        
                        var requestData = {
                            "trigger_id": data.trigger_id,
                            "notify_on_cancel": true,
                            "dialog": {
                                "callback_id": "newplan_callback",
                                "title": "New FOCUS for this week!",
                                "submit_label": "Request",
                                "notify_on_cancel": true,
                                "state": "Limo",
                                "elements": [
                                    {
                                        "label": "Select one thing you want to focus for this week",
                                        "type": "select",
                                        "name": "weekly_focus",
                                        "options": focuses
                                    },
                                    {
                                        "label": "How many hours do you want to spend",
                                        "name": "focus_hours",
                                        "type": "text",
                                        "subtype": "number",
                                        "placeholder": "Numbers only"
                                      }
                                ],
                            },
                        };
                        startDialog(requestData);
                    }
                }
            });
        }
    };
})

module.exports = router;
