const mongoose = require('mongoose');
const { Schema } = mongoose;
const UserCompanyStatus = require('./UserCompanyStatus').schema;

const BlackUsers = new Schema({
    userId   : { type : String, required : true },
    IsBlocked   : { type : Boolean, required : true },
    currentLocation : { type : Number, required : true },
    companyA    : { type : UserCompanyStatus, required : true },
    companyB    : { type : UserCompanyStatus, required : true },
    companyC    : { type : UserCompanyStatus, required : true },
    companyD    : { type : UserCompanyStatus, required : true },
    companyE    : { type : UserCompanyStatus, required : true },
})

module.exports = mongoose.model('BlackUsers', BlackUsers);