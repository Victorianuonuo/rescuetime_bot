var mongoose = require('mongoose');
//mongoose.connect(process.env.MONGODB_URI,{ useNewUrlParser: true }); 
var {User, Apikey, ConfigUser, WeeklyPlan, WeeklyMultiPlan} = require('./models/models');
var CLIENT_ID = process.env.CLIENT_ID;
var CLIENT_SECRET = process.env.CLIENT_SECRET;
var request = require('request');
var {WeeklyMultiPlan, ShortFocus, ShareLink} = require('./models/models');
mongoose.Promise = global.Promise;

var emotions = [":thumbsup:", ":heart:", ":joy:", ":confused:"];
function reactionMsg(title) {
    var elements = [];
    for(var i=0; i<emotions.length; i++) {
        elements.push({
            "type": "button",
            "text": {
                "type": "plain_text",
                "text": `${emotions[i]}`,
                "emoji": true
            },
            "value": "quick_reaction"
        });
    }
    var msg = [
        {
            "type": "divider"
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": `*${title}*`
            }
        },
        {
            "type": "actions",
            "block_id": "shortFocusReaction",
            "elements": elements
        }
    ];
    return msg;
}

function updateMessage(bot, prevMessage) {
    var slackID = prevMessage.user.id;
    //console.log("!!!!! in updateMessage: ", prevMessage);
    var channel = prevMessage.channel.id;
    var ts = prevMessage.message.ts;
    var prevBlocks = prevMessage.message.blocks;
    var id = prevBlocks[0].block_id; //shortFocus or  dailyReminder
    console.log("????? in updateMessage: ", id); 

    for(var i=0; i<prevBlocks.length; i++) {
        if(id == 'dailyReminder' && prevBlocks[i].type == 'image') {
            var imgUrl = prevBlocks[i].image_url;
            prevBlocks[i] = {
                "type": "image",
                "image_url": `${imgUrl}`,
                "alt_text": "image1"
            }
        }
        if(prevBlocks[i].block_id == 'shortFocusReaction') {
            prevBlocks[i] = {
                "type": "section",
                "text": {
                "type": "mrkdwn",
                "text": `${prevMessage.actions[0].text.text}`
                }
            };
        }
    }
    // TODO: gupdate the database !!!         
    //console.log("!!!!!!! prevBlocks: ", prevBlocks);
    bot.updateMessage(channel, ts, '', {as_user:true, blocks:prevBlocks});

    var update = {
        $set: {
          "reaction": `${prevMessage.actions[0].text.text}`
        }
    };
    if(id == 'dailyReminder') {
        WeeklyMultiPlan.findOneAndUpdate({slackID:slackID, done:true}, update, {sort : {"_id": -1}})
        .then(function(res){
            console.log("weeklyMultiPlan reaction update success");
        })
        .catch(function(err){
            console.log("weeklyMultiPlan reaction update fail ", err);
        })
    } else if(id == 'shortFocus') {
        ShortFocus.findOneAndUpdate({slackID:slackID, done:true}, update, { sort : { "_id": -1 } })
        .then(function(res){
            console.log("!!!!!! update success: ");
        })
        .catch(function(err){
            console.log("!!!! update failed err: ", err);
        })
    }
}

function quickReactionTest(bot, slackID) {
    var test = reactionMsg("testing reaction");
    bot.postMessage(slackID, "", {as_user:true, blocks:test});
}

module.exports = {
    quickReactionTest: quickReactionTest,
    updateMessage: updateMessage,
    reactionMsg: reactionMsg
}
