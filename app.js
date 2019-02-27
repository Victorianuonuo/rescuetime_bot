var logger = require('morgan');
const {google} = require('googleapis');
var {User, Apikey} = require('./models')
var mongoose = require('mongoose');
var _ = require('underscore');
var models = require('./models');
var googleAuth = require('google-auth-library');
var fs = require('fs');
var slackID;
var url;
var request = require('request');
var {bot, requestResuetime} = require('./bot');
var axios = require('axios');

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

app.post('/apikey', function(req, res){
    var data = JSON.parse(req.body.payload);
    if(!slackID){
        slackID = data.user.id;
    }
    console.log(data);
    if(data.type=="dialog_submission"){
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
        }).catch(function(error) {
            console.log("error");
            bot.postMessage(slackID, "Ooops!!! Invalid key. Please try agin by saying rescuetime to me and input the right key", {as_user:true});
        });
        res.send();
    }else if(data.type == "interactive_message"){
        if(data.actions[0].name == "rescuetime_api_key_yes"){
            Apikey.findOne({slackID: slackID}).exec(function(err, apikey){
                if(err){
                    console.log(err)
                } else {
                    console.log(apikey);
                    if(!apikey){
                        startDialog(data);
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

function startDialog(data){
    var requestData = {
        "trigger_id": data.trigger_id,
        "dialog": {
            "callback_id": "rescuetime_callback",
            "title": "Request a Ride",
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
            console.log(err)
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
                    console.log(err)
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

app.post('/command', function(req, res) {
    res.send('Your ngrok tunnel is up and running!');
});

app.listen(process.env.PORT || 3000);

