var express = require('express');
var router = express.Router();
var {startDialog} = require('./common');

router.post('/config', function(req, res) {
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

module.exports = router;
