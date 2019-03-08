var logger = require('morgan');
const {google} = require('googleapis');
var {User, Apikey, ConfigUser} = require('./models')
var mongoose = require('mongoose');
var _ = require('underscore');
var googleAuth = require('google-auth-library');
var fs = require('fs');
var slackID;
var url;
var request = require('request');
var {bot, requestResuetime} = require('./bot');
var axios = require('axios');
var passport = require('passport');
var RescueTimeStrategy = require('passport-rescuetime').Strategy;
app.use(passport.initialize());

passport.use(new RescueTimeStrategy({
    clientID: process.env.RESCUETIME_ID,
    clientSecret: process.env.RESCUETIME_SECRET,
    callbackURL: process.env.DOMAIN+"/apikey/rescuetime/callback"
  },
  function(accessToken, refreshToken, profile, done) {
    console.log("RescueTimeStrategy connect through button, accessToken, refreshToken, profile", accessToken, refreshToken, profile);
    Apikey.findOne({slackID: slackID}).exec(function(err, apikey){
        if(err){
            console.log(err);
            done(err, apikey);
        } else {
            console.log("apikey, ", apikey);
            if(apikey){
                var newApikey = apikey;
                newApikey.rescuetime_key = accessToken;
            }else{
                var newApikey = new Apikey({
                    slackID: slackID,
                    rescuetime_key: accessToken,
                });
            }
            console.log("newApikey, ", newApikey);
            newApikey.save()
            .then( () => {
                done(err, newApikey);
            })
            .catch((err) => {
                done(err, newApikey);
            });
        }
    });
  }
));

var https = require("https");
setInterval(function() {
    https.get(process.env.DOMAIN);
    console.log("keepwake");
}, 300000); // every 5 minutes (300000)
//This is for the wake process, mongthly quoto limited


mongoose.connect(process.env.MONGODB_URI,{ useNewUrlParser: true });
mongoose.Promise = global.Promise;
var express = require('express');
require('./bot')
var app = express();
var bodyParser = require('body-parser');
app.use(logger('dev'));
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
var CLIENT_ID = process.env.CLIENT_ID;
var CLIENT_SECRET = process.env.CLIENT_SECRET;
const PORT=3000;
app.get('/oauth', function(req, res){
    oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.DOMAIN + '/connect/callback'
    )
    url = oauth2Client.generateAuthUrl({
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
    slackID = req.query.auth_id;
    res.redirect(url);
})

app.get('/apikey/rescuetime/oauth', function(req, res, next) {
    slackID = req.query.auth_id;
    passport.authenticate('rescuetime')(req, res, next);
});

app.get('/apikey/rescuetime/callback',
  passport.authenticate('rescuetime', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    console.log("Successful rescuetime button connection.");
    bot.postMessage(slackID, "Congratulations! You successfully add rescuetime.", {as_user:true});
    res.status(200).send("Your account was successfully authenticated");
  });

isObject = function(a) {
    return (!!a) && (a.constructor === Object);
};

function verifyJson(jsonfile){
    var keys = {
        "incoming":["calendar_event"],
        "outgoing":["slack"],
        "frequency":["daily", "weekly"],
        "num_of_event":["0", "1"],
        "ignore":['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
    };
    var errors;
    console.log(jsonfile);

    try {
        jsonfile = JSON.parse(jsonfile);
        console.log("jsonfile", jsonfile);
        if(isObject(jsonfile)){
            for (var key in keys){
                if(errors){
                    break;
                }
                if(key in jsonfile){
                    if (typeof jsonfile[key] === 'string' || jsonfile[key] instanceof String){
                        if(!keys[key].includes(jsonfile[key])){
                            errors = jsonfile[key]+" not defined!!! options: "+keys[key];
                            break;
                            console.log(errors);
                    }
                    }else if(!Array.isArray(jsonfile[key])){
                        for(var subkey in jsonfile[key]){
                            console.log(jsonfile[key]+' '+subkey);
                            if(!keys[key].includes(subkey)){
                                errors = subkey+" not defined!!! options: "+keys[key];
                                break;
                            }
                        }
                    }else{
                        for(var subkey in jsonfile[key]){
                            console.log(jsonfile[key]+' '+jsonfile[key][subkey]);
                            if(!keys[key].includes(jsonfile[key][subkey])){
                                errors = jsonfile[key][subkey]+" not defined!!! options: "+keys[key];
                                break;
                            }
                        }
                    }
                }else{
                    errors = key+" not in jsonfile!!!";
                    break;
                }
            }
        }else{
            errors = "cannot parse as Json";
        }
    } catch (e) {
        console.log("not JSON");
        console.log(e);
        errors = "not JSON";
    }

    return {"errors": errors};
}

app.post('/apikey', async function(req, res){
    var data = JSON.parse(req.body.payload);
    if(!slackID){
        slackID = data.user.id;
    }
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
    }else if(data.type=="dialog_submission" && data.callback_id=="config_callback"){
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
                //res.status(200).json({"errors":[{"name": "slackID", "error": "Ooops!!! Invalid slackID. Please input the right slackID or all for all users to change the config file"}]});
                //return;
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

    }else if(data.type == "interactive_message"){
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
                        res.send("Ooops!!! You have already submitted your rescuetime api key!");
                    }
                }
            });
        }else if(data.actions[0].name == "rescuetime_api_key_no"){
            //bot.postMessage(slackID, "So sorry that you said no to add rescuetime. Maybe you would change your mind later.", {as_user:true});
            res.send("So sorry that you said no to add rescuetime. Maybe you would change your mind later. When you are ready, try agin by saying rescuetime to me and input the right key.");
        }
    };
})

function startDialog(requestData){
    var requestJson = {
        url: "https://api.slack.com/api/dialog.open",
        method: "POST",
        json: true,
        headers: {
            "content-type": "application/json",
            "Authorization": "Bearer "+process.env.NUDGE_BOT_TOKEN,
        },
        body: requestData,
    };
    console.log("requestJson", requestJson);
    request(requestJson, function (error, response, body) {
        console.log('error:', error); // Print the error if one occurred
        console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
        console.log('body:', body); // Print the HTML for the Google homepage.
    });
}


app.get('/connect/callback', function(req, res) {
    const code = req.query.code;
    oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.DOMAIN + '/connect/callback'
    )
    console.log("this is oauth", oauth2Client);
    oauth2Client.getToken(code, function (err, tokens) {
        if(err) {
            console.log(err);
        } else {
            //set credentials. not entirely sure what this does but necessary for google plus
            //when a person gives access to their google calendar, we also make a request to google plus
            //with their oauth2client in order to get their email address which is then saved in the user object
            //in mongodb.
            oauth2Client.setCredentials(tokens);
            console.log("this is tokens", tokens);
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
                        setTimeout(requestResuetime(slackID), 1000);
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

app.get('/', function(req, res) {
    res.send('Nudgebot is working! Path Hit: ' + req.url);
});

app.post('/command/config', function(req, res) {
    var data = req.body;
    console.log(data);
    var requestData = {
        "trigger_id": data.trigger_id,
        "dialog": {
            "callback_id": "config_callback",
            "title": "Upload a config file",
            "submit_label": "Request",
            "notify_on_cancel": true,
            "state": "Limo",
            "elements": [
                {
                    "label": "Key to authenticate your identity",
                    "name": "key",
                    "type": "text",
                    "placeholder": "key to upload the config file"
                },
                {
                    "label": "slack ID for one user or `all` for all users",
                    "name": "slackID",
                    "type": "text",
                    "placeholder": "slack ID for one user or `all` for all users"
                },
                {
                    "label": "Config file of Json format",
                    "name": "configfile",
                    "type": "textarea",
                    "hint": `'incoming', 'outgoing', 'frequency', 'num_of_event', 'ignore'`,
                    "value": `{
                        "incoming":"calendar_event",
                        "outgoing":"slack",
                        "frequency":"daily",
                        "num_of_event":{
                            "0":"You are slacking off. No plans made today.",
                            "1":"Fantastic job! You made plans today."
                        },
                        "ignore":[
                            "saturday",
                            "sunday"
                        ]
                    }`
                },
            ],
        },
    };
    startDialog(requestData);
    res.send();
});


app.listen(process.env.PORT || 3000);

