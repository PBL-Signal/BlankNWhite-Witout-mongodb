// schemas/room.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const roomSchema = new Schema({
    manager : { type : String, required : true },
    creationDate : { type : String, required : true },
    endDate: { type : String },
    // isActive : { type : Boolean, required : true },
    // limitedTime: { type : Number, required : true },
    maxPlayer : { type : Number, required : true },
    minPlayer : { type : Number, required : true },
    players : { type : Array },
    players_num: { type : Number },
    // quizID: { type : String, required : true },
    roomPin: { type : String, required : true },
})


module.exports = mongoose.model('room', roomSchema);