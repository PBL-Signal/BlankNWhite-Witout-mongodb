const mongoose = require('mongoose');
const { Schema } = mongoose;

const sectionSchema = new Schema({
    roomPin: { type : String, required : true },
    sectionInfo : { type : Array, required : true }
});


module.exports = mongoose.model('section', sectionSchema);