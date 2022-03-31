const mongoose = require('mongoose');

const { Schema } = mongoose;

const areaSchema = new Schema({
    Corp : {
        type : String,
        required : true,
    },
    area : {
        type : String,
        required : true
    },
    level : {
        type : Number,
        required : true
    },
    vuln : {
        type : Number,
        required : true
    }
});


module.exports = mongoose.model('area', areaSchema);