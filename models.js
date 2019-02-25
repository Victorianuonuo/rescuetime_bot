var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var userSchema = new Schema({
  slackID: String,
  auth_id: String,
  token: Object,
  email: String
});

var apikeySchema = new Schema({
	slackID: String,
	rescuetime_key: String
});


var User = mongoose.model('User', userSchema);
var Apikey = mongoose.model('Apikey', apikeySchema);
module.exports = {
  User: User,
  Apikey: Apikey
 };
