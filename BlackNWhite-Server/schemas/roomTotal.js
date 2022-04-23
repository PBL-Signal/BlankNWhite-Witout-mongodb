// schemas/room.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const RoomTotalSchema = new Schema({
    server_start  : { type : Date, required : true },
    server_end  : { type : Date, required : true },
    blackTeam  : { type : BlackTeam, required : true },
    whiteTeam  : { type : WhiteTeam, required : true },
    companyA    : { type : Company, required : true },
    companyB    : { type : Company, required : true },
    companyC    : { type : Company, required : true },
    companyD    : { type : Company, required : true },
    companyE    : { type : Company, required : true },
})


const BlackTeam = new Schema({
    total_pita   : { type : Number, required : true },
    users   : { type : BlackUsers, required : true },
})

const WhiteTeam = new Schema({
    total_pita   : { type : Date, required : true },
    users   : { type : WhiteUsers, required : true },
})

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

const UserCompanyStatus = new Schema({
    warnCnt    : { type : Number, required : true },
    detectCnt    : { type : Array, required : true },
})

const WhiteUsers = new Schema({
    userId   : { type : String, required : true },
    IsBlocked   : { type : Boolean, required : true },
    currentLocation    : { type : Number, required : true },
})

const Company = new Schema({
    abandonStatus : { type : Boolean, required : true },
    penetrationTestingLV : { type : Array, required : true },
    attackLV : { type : Array, required : true },
    sections : [Section]
})

const Section = new Schema({
    destroyStatus  : { type : Boolean, required : true },
    level  : { type : Number, required : true },
    attack : { type : Progress, required : true },
    response : { type : Progress, required : true },
})


const Progress = new Schema({
    progress  : { type : Array, required : true },
    last  : { type : Number, required : true },
})

module.exports = mongoose.model('RoomTotalSchema', RoomTotalSchema);
module.exports = mongoose.model('BlackTeam', BlackTeam);
module.exports = mongoose.model('WhiteTeam', WhiteTeam);
module.exports = mongoose.model('BlackUsers', BlackUsers);
module.exports = mongoose.model('UserCompanyStatus', UserCompanyStatus);
module.exports = mongoose.model('WhiteUsers', WhiteUsers);
module.exports = mongoose.model('Company', Company);
module.exports = mongoose.model('Section', Section);
module.exports = mongoose.model('Progress', Progress);
