var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var userSchema = new Schema({
    slackID: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    auth_id: {
        type: String,
        required: true
    },
    token: {
        type: Object,
        required: true
    },
    email: {
        type: String,
        required: true
    }
});

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

var shareLinkSchema = new Schema({
    slackID: {
        type: String,
        required: true,
        index: true
    },
    original_link: {
        type: String,
        required: true,
        index: true
    },
    link: String,
    number: String,
    isDocx: Number,
    progress: Number,
});
shareLinkSchema.index({ slackID: 1, original_link: 1 }, { unique: true });

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

var User = mongoose.model('User', userSchema);
var Apikey = mongoose.model('Apikey', apikeySchema);
var ConfigUser = mongoose.model('ConfigUser', configUserSchema);
var WeeklyPlan = mongoose.model('WeeklyPlan', weeklyPlanSchema);
var SlackKey = mongoose.model('SlackKey', slackKeySchema);
var UserPresence = mongoose.model('UserPresence', userPresenceSchema);
var WeeklyMultiPlan = mongoose.model('WeeklyMultiPlan', weeklyMultiPlanSchema);
var ShortFocus = mongoose.model('ShortFocuse', shortFocusSchema);
var ShareLink = mongoose.model('ShareLink', shareLinkSchema);
module.exports = {
    User: User,
    Apikey: Apikey,
    ConfigUser: ConfigUser,
    WeeklyPlan: WeeklyPlan,
    SlackKey: SlackKey,
    UserPresence: UserPresence,
    WeeklyMultiPlan: WeeklyMultiPlan,
    ShortFocus: ShortFocus,
    ShareLink: ShareLink,
};
