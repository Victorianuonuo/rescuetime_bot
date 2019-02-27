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


var User = mongoose.model('User', userSchema);
var Apikey = mongoose.model('Apikey', apikeySchema);
module.exports = {
    User: User,
    Apikey: Apikey
 };
