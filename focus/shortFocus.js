var mongoose = require('mongoose');
//mongoose.connect(process.env.MONGODB_URI,{ useNewUrlParser: true }); 
var {Apikey, ShortFocus} = require('../models/models');
var axios = require('axios');
mongoose.Promise = global.Promise;

function updatePrevMsg(bot, data) {
    var slackID = data.user.id;
    var channel = data.channel.id;
    var ts = data.message.ts;
    var prevBlocks = data.message.blocks; 
    var msg = data.actions[0].value;
    var text = data.actions[0].text.text;
    var r = /\d+/;
    var match = msg.match(r);     
    console.log("!!!!!! match: ", match);
    var time = match[0];
    var activity = "";
    var target = "";
    if(msg.includes("Software Development")) {
        activity = "Software Development";
        target = "General Software Development";
    } else if(msg.includes("Write More")) {
        activity = "Write More";
        target = "Writing";
    } else if(msg.includes("Learn new things")) {
        activity = "Learn new things";
        target = "General Reference & Learning";
    }

    var updatedMsg = {
		"type": "section",
		"text": {
			"type": "plain_text",
			"text": `Nice! Focus on ${activity} and I will remind you after ${text}`,
			"emoji": true
		}
    }
    prevBlocks[2] = updatedMsg;
    bot.updateMessage(channel, ts, '', {as_user:true, blocks:prevBlocks});
}

function setShortFocus(bot, dataMsg) {
    var slackID = dataMsg.user.id;
    //console.log("!!!!! in updateMessage: ", prevMessage);
    var channel = dataMsg.channel.id;
    var ts = dataMsg.message.ts;
    var prevBlocks = dataMsg.message.blocks; 
    
    var msg = dataMsg.actions[0].value;
    var text = dataMsg.actions[0].text.text;
    var r = /\d+/;
    var match = msg.match(r);     
    console.log("!!!!!! match: ", match);
    var time = match[0];
    var activity = "";
    var target = "";
    if(msg.includes("Software Development")) {
        activity = "Software Development";
        target = "General Software Development";
    } else if(msg.includes("Write More")) {
        activity = "Write More";
        target = "Writing";
    } else if(msg.includes("Learn new things")) {
        activity = "Learn new things";
        target = "General Reference & Learning";
    }
    /*
    var updatedMsg = {
		"type": "section",
		"text": {
			"type": "plain_text",
			"text": `Nice! Focus on ${activity} and I will remind you after ${text}`,
			"emoji": true
		}
    }
    prevBlocks[2] = updatedMsg;
    bot.updateMessage(channel, ts, '', {as_user:true, blocks:prevBlocks});
    */

    // set short focus 
    Apikey.findOne({slackID: slackID}).exec(function(err, user) {
        if(err) {
            console.log("something wrong happen");
        } else {
            if(user) {
                var rescuetimeKey = user.rescuetime_key;
                var secs = 0;
                if(!rescuetimeKey) {
                    return;
                }
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
                                var msg = `You haven't finished your ${user.plans.get("time")} minutes on ${user.plans.get("activity")} yet!`;
                                bot.postMessage(slackID, msg, {as_user:true});
                            } else {
                                var data = response.data;   
                                for(var i=0; i<data.rows.length; i++) {
                                    if(data.rows[i][4] == target) {
                                        console.log("!!!!!!! "+data.rows[i][3]+" "+data.rows[i][4]+" and seconds: "+data.rows[i][1]);
                                        secs += Number(data.rows[i][1]);
                                    }   
                                }
                                            
                                var plan = [["activity", activity], ["time", time]];
                                var rescuetimeStart = [["target", target], ["secs", secs]];
                                
                                var newWShortFocus = new ShortFocus({
                                    slackID: slackID,
                                    plans: plan,
                                    rescueTimeStart: rescuetimeStart,
                                    done: false,
                                });
                                //console.log("!!!!!! newShorFocus: ", newWShortFocus);
                                newWShortFocus.save()
                                .then(() => {
                                    updatePrevMsg(bot, dataMsg);
                                    //bot.postMessage(slackID, "testing ok!!", {as_user:true});
                                    //bot.postMessage(slackID, `Great! Focus ${num} minutes on ${activity}. I will remind you later :smile:`, {as_user:true});
                                    setTimeout(function(){checkShortFocus(slackID);}, Number(time)*60*1000);
                                    //setTimeout(function(){checkShortFocus(bot, slackID);}, 1*60*1000);
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
            }
            else {
                bot.postMessage(slackID, "You didn't add your api key!", {as_user:true});
            }
        }
    });
}

function checkShortFocus(bot, slackID) {
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
                            var targetSecs = Number(user.plans.get("time"))*60;
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
                                        //console.log("?????? "+data.rows[i][3]+" "+data.rows[i][4]+" and seconds: "+data.rows[i][1]);
                                        secs += Number(data.rows[i][1]);
                                    }
                                }
                                var diff = secs - startSecs;
                                //diff = 100000;
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
                                            "text": `Congrats! You decide to spend *${user.plans.get("time")} minutes* on *${user.plans.get("activity")}* and you did it!:smile:`
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
                                            "text": `Oops! You decide to spend *${user.plans.get("time")} minutes* on *${user.plans.get("activity")}* and it seems you didn't focus too much on it:cry:`
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
                        } else {
                            bot.postMessage(slackID, "You didn't set up your RescueTime key!", {as_user:true});
                            // authenResuetime(slackID);
                        }
                    });
                }
            } else {
                bot.postMessage(slackID, "You didn't set up your RescueTime key!", {as_user:true});
                //authenResuetime(slackID);
            }
        }
    });
}

module.exports = {
    setShortFocus: setShortFocus,
    checkShortFocus: checkShortFocus
}