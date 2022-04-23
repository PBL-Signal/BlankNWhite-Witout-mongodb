const mongoose = require('mongoose');
const { Schema } = mongoose;

const WhiteUsers = new Schema({
    userId   : { type : String, required : true },
    IsBlocked   : { type : Boolean, required : true },
    currentLocation    : { type : Number, required : true },
})

module.exports = mongoose.model('WhiteUsers', WhiteUsers);