var logger = require('morgan');
const {google} = require('googleapis');
var {User} = require('./models')
var mongoose = require('mongoose');
var _ = require('underscore');
var models = require('./models');
var googleAuth = require('google-auth-library');
var fs = require('fs');
var slackID;
var channelID;
var url;
var {bot} = require('./bot')

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
    channelID = req.query.cnl_id;
    res.redirect(url);
})

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
                        console.log("channelID: "+channelID);
                        res.status(200).send("Your account was successfuly authenticated");
                        bot.postMessage(slackID, "Congratulations! You are successfully connected to google calendar", {as_user:true});
                    })
                    .catch((err) => {
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

