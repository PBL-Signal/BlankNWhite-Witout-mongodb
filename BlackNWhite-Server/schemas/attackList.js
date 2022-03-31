// schemas/room.js
const { json } = require('body-parser');
const mongoose = require('mongoose');
const { Schema } = mongoose;

const attackListSchema = new Schema({
    roomPin: { type : String, required : true },
    team : { type : String, required : true },
    attackCard : { type : Array, required : true }
})


module.exports = mongoose.model('attackList', attackListSchema);