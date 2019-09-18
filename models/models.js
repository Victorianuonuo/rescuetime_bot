var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var apikeySchema = new Schema({
    slackID: {
        type: String,
        required: true,
        index: true,
        unique: true
    },
    rescuetime_key: {
        type: String,
        required: true
    },
    features: {
        type: [String],
        require: true
    }
});

var weeklyPlanSchema = new Schema({
    slackID: {
        type: String,
        required: true,
        index: true
    },
    week: {
        type: String,
        required: true,
        index: true
    },
    plans: {
        type: Map,
        of: String
    }
});
weeklyPlanSchema.index({ slackID: 1, week: 1 }, { unique: true });

var weeklyMultiPlanSchema = new Schema({
    slackID: {
        type: String,
        required: true,
        index: true
    },
    week: {
        type: String,
        required: true,
        index: true
    },
    plans: {
        type: Map,
        of: String
    },
    done: {
        type: Boolean,
        required: true
    },
    reaction: {
        type: String
    }
});
var shortFocusSchema = new Schema({
    slackID: {
        type: String,
        required: true,
        index: true
    },
    plans: {
        type: Map,
        of: String
    },
    rescueTimeStart: {
        type: Map,
        of: String
    },
    done: {
        type: Boolean,
        required: true,
    },
    reaction: {
        type: String
    }
});

var distractionsDelaySchema = new Schema({
    slackID: {
        type: String,
        required: true,
        index: true
    },
    date: {
        type: String,
        required: true,
        index: true
    },
    time_left: {
        type: Number,
        required: true
    },
    time_spend: {
        type: Number,
        required: true
    },
    ts: {
        type: String,
        required: true
    },
    skip: {
        type: Boolean,
        required: true
    }
});
distractionsDelaySchema.index({ slackID: 1, date: 1 }, { unique: true });

var configUserSchema = new Schema({
    slackID: {
        type: String,
        required: true,
        index: true,
        unique: true
    },
    configJson: {
        type: String,
        required: true
    },
    auth_id: {
        type: String,
        required: true
    }
});

var slackKeySchema = new Schema({
    slackID: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    access_token: {
        type: String,
        required: true
    },
});

var presenceSchema = new Schema({
    queryTime:{
        type: String,
        required: true,
        unique: true
    },
    queryResult:{
        type: String,
        require: true
    }
});

var userPresenceSchema = new Schema({
    slackID: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    presences:[presenceSchema]
});

var Apikey = mongoose.model('Apikey', apikeySchema);
var ConfigUser = mongoose.model('ConfigUser', configUserSchema);
var WeeklyPlan = mongoose.model('WeeklyPlan', weeklyPlanSchema);
var SlackKey = mongoose.model('SlackKey', slackKeySchema);
var UserPresence = mongoose.model('UserPresence', userPresenceSchema);
var WeeklyMultiPlan = mongoose.model('WeeklyMultiPlan', weeklyMultiPlanSchema);
var ShortFocus = mongoose.model('ShortFocuse', shortFocusSchema);
var DistractionsDelay = mongoose.model('DistractionsDelay', distractionsDelaySchema);
module.exports = {
    Apikey: Apikey,
    ConfigUser: ConfigUser,
    WeeklyPlan: WeeklyPlan,
    SlackKey: SlackKey,
    UserPresence: UserPresence,
    WeeklyMultiPlan: WeeklyMultiPlan,
    ShortFocus: ShortFocus,
    DistractionsDelay: DistractionsDelay,
};
