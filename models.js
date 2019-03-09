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


var User = mongoose.model('User', userSchema);
var Apikey = mongoose.model('Apikey', apikeySchema);
var ConfigUser = mongoose.model('ConfigUser', configUserSchema);
var weeklyPlan = mongoose.model('weeklyPlan', weeklyPlanSchema);
module.exports = {
    User: User,
    Apikey: Apikey,
    ConfigUser: ConfigUser,
    weeklyPlan: weeklyPlan,
};
