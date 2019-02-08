# Nudge Bot

### Purpose

The goal of this project is to drive behavior change by delivering personalized nudges that are informed by habitual patterns inferred from each user’s personal digital traces. Behavioral Economists define a nudge as an intervention that steers people in a particular direction but without forcing them to take an action. In this project, we will deliver digital nudges through slack.

### Overview

In this project, we will deliver digital nudges through slack.

This Nudge Bot is built using many asynchronous API's. The two core APIs used are Slackbots and Google Calendar API. Start a conversation with the bot by saying something first. If users say hello to the bot, bot would request the permission to access the users' Google Calendar. If successfully connected, the bot would say that you are connected. Everyday at 7am, bot should check if users have any events planned on their calendar. Then send a message accordingly.

  
```Example:  
User: "Hi"  
Bot: "Please click the following button to activate your account"  
User: ...(Connecting)
Bot: "Congratulations! You are successfully connected to google calendar"
User: "Hi"  
Bot: "Hi! You are connected with Google Calendar now!"
(7 am)Bot: "You are slacking off. No plans made today." or "Fantastic job! You made plans today."
```

### Usage

#### Authenicating throught Google:  
![](./resources/authen.gif)

## Install

`npm install`

## Running

You will need to create a slack bot and deploy it to heroku( or ngrok as long as it has domain name for the app to be registered in Google API). Instructions on how to do this can be found [here.](https://medium.com/@alexstroulger/how-to-build-a-slackbot-600635b12a38)

Since the free version of Heroku has been used, the server will automatically sleep after 30 minutes. To prevent it from sleeping, I implemented a function in the code that will send a HTTP request every 10 minutes. 

Instructions on how to get Google Calendar API key can be found [here.](https://medium.com/@karanbhomia/integrating-google-calendar-api-to-web-app-using-serverless-node-js-functions-part-1-of-2-8a176595110b)
  
You will also need to set up a mongodb. Instructions on how to do this can be found [here.](http://fredrik.anderzon.se/2017/01/17/setting-up-a-free-mongodb-database-on-mlab-and-connecting-to-it-with-node-js/)  

Finally, set all of your environmental variables in heroku. You will need the following names for your environment variables:  

DOMAIN: *Heroku domain name*  
GOOGLE_CLIENT_ID: *Google API Credentials*  
GOOGLE_CLIENT_SECRET: *Google API Credentials*  
MONGODB_URI: *Mongo DB credentials*  
NUDGE_BOT_TOKEN: *Bot User OAuth Access Token*  
TZ: America/New_York *The time zon you are in*

`npm start`

## Built With

* [Slackbots](https://www.npmjs.com/package/slackbots/) - Slack chat application 
* [Google Calendar API](https://developers.google.com/calendar/) - Used by bot to read schedules 
* [Express](https://expressjs.com/) - Backend Server  

