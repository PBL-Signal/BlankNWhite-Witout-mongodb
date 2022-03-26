const mongoose = require('mongoose');

const { Schema } = mongoose;

const testSchema = new Schema({
    nickanme : {
        type : String,
        required : true.valueOf,
        unique : true,
    },
    is_manager : {
        type : Boolean,
        required : true
    },
});


module.exports = mongoose.model('test', userSchema);