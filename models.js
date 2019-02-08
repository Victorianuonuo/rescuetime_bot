var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var userSchema = new Schema({
  slackID: String,
  auth_id: String,
  token: Object,
  email: String
})


var User = mongoose.model('User', userSchema);
module.exports = {
  User: User,
 };
