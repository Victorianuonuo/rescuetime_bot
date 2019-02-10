var SlackBot = require('slackbots');
var mongoose = require('mongoose');
//mongoose.connect(process.env.MONGODB_URI,{ useNewUrlParser: true }); // only when test bot.js
var models = require('./models');
const {google} = require('googleapis');
var {User} = require('./models');
var slackID;
var _ = require('underscore')
var googleAuth = require('google-auth-library');
var CronJob = require('cron').CronJob;

const envKey = process.env.NUDGE_BOT_TOKEN;
mongoose.Promise = global.Promise;

// create a bot
var bot = new SlackBot({
    token: envKey,
    name: 'nudgebot'
});

const startCronJob = function(bot){
    var job = new CronJob({
      cronTime: '00 51 01 * * *',
      onTick: function() {
        console.log('tick!');
        dailyCheck(bot); 
      }
        
    });
    job.start();
}

bot.on('start', function() {
    console.log('bot start!');
    startCronJob(bot);
    //dailyCheck(bot); 
    //bot.postMessageToUser('so395', 'Hi, This is nudge bot!',{as_user:true}); 
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
  switch (message.type) {
  case "message":
    if (message.channel[0] === "D" && message.bot_id === undefined) {
      User.findOne({slackID: slackID}).exec(function(err, user){
        if(err){
          console.log(err)
        } else {
          console.log(user);
        if(!user){
          authenticate(slackID, message);
        } else {
          bot.postMessage(message.user, 'Hi! You are connected with Google Calendar now!', {as_user:true});
        }
        }
      })
    }
    break;
  }
  
});

function authenticate(slackID, message){
  bot.postMessage(message.user, 'Please click the following button to activate your account' , {
  as_user:true,
  "attachments": [
    {
      "fallback": "activate",
      "actions": [
        {
          "type": "button",
          "text": "connect",
          "url": process.env.DOMAIN + '/oauth?auth_id='+slackID+'&cnl_id='+message.channel
        }
      ]
    }
  ]
  });
}

function dailyCheck(bot){
  User.find({}, function(err, users) {
      var userMap = {};

      users.forEach(function(user) {
        oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          process.env.DOMAIN + '/connect/callback'
        );
        oauth2Client.setCredentials({
          refresh_token: user.token.refresh_token
        });
        oauth2Client.refreshAccessToken(function(err, tokens) {
          user.token = tokens;
          user.save()
          .then((user)=>{
            listEvents(bot, user, oauth2Client);
          })
        });
      });

  });
}

function listEvents(bot, user, auth) {
  const calendar = google.calendar({version: 'v3', auth});
  var timeMin = new Date();
  timeMin.setHours(0,0,0,0);
  var timeMax = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000);
  timeMax.setHours(0,0,0,0);
  console.log("timeMin: "+timeMin.toISOString()+" "+timeMin);
  console.log("timeMax: "+timeMax.toISOString()+" "+timeMax);
  calendar.events.list({
    calendarId: 'primary',
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString()
  }, (err, res) => {
    if (err) return console.log('The API returned an error: ' + err);
    const events = res.data.items;
    console.log(events);
    if (events.length) {
      console.log('The number of events: '+ events.length);
      bot.postMessage(user.slackID, 'Fantastic job! You made plans today',{as_user:true});
    } else {
      console.log('No upcoming events found.');
      bot.postMessage(user.slackID, 'You are slacking off. No plans made today',{as_user:true});
    }
  });
}

module.exports = {
  bot: bot
}
