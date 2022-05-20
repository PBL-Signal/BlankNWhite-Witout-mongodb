const mongoose = require('mongoose');
const { Schema } = mongoose;
const progress = require('./Progress').schema;

const Section = new Schema({
    destroyStatus  : { type : Boolean, required : true },
    level  : { type : Number, required : true },
    vuln : { type : Number, required : true },
    attack : { type : progress, required : true },
    response : { type : progress, required : true },
})

module.exports = mongoose.model('Section', Section); 