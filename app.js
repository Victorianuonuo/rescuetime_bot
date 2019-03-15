var logger = require('morgan');
var {Apikey} = require('./models/models');
var mongoose = require('mongoose');
var command = require('./routes/command');
var apikey = require('./routes/apikey');
var session = require('express-session');
var _ = require('underscore');
var {bot, authenResuetime, getMonday} = require('./bot');
var passport = require('passport');
var RescueTimeStrategy = require('passport-rescuetime').Strategy;

var https = require("https");
setInterval(function() {
    https.get(process.env.DOMAIN);
    console.log("keepwake");
}, 300000); // every 5 minutes (300000)
//This is for the wake process, mongthly quoto limited

mongoose.connect(process.env.MONGODB_URI,{ useNewUrlParser: true });
mongoose.Promise = global.Promise;
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
app.use(logger('dev'));
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.use(session({
  maxAge: 86400000, // 24 hours
  secret: 'no-one-will-find-out',
  resave: true,
  saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());
const PORT=3000;

passport.use(new RescueTimeStrategy({
    clientID: process.env.RESCUETIME_ID,
    clientSecret: process.env.RESCUETIME_SECRET,
    callbackURL: process.env.DOMAIN+"/apikey/rescuetime/callback",
    passReqToCallback: true,
    scope: ['time_data', 'category_data', 'productivity_data', 'alert_data', 'highlight_data', 'focustime_data']
  },
  function(req, accessToken, refreshToken, profile, done) {
    console.log("RescueTimeStrategy connect through button, accessToken, refreshToken, profile", accessToken, refreshToken, profile);
    Apikey.findOne({slackID: req.query.auth_id}).exec(function(err, apikey){
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
                    slackID: req.query.slackID,
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

app.get('/', function(req, res) {
    res.send('Nudgebot is working! Path Hit: ' + req.url);
});

app.use('/command', command);
app.use('/apikey', apikey);

app.listen(process.env.PORT || 3000);

