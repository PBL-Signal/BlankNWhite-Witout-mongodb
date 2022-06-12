const mongoose = require('mongoose');
const { Schema } = mongoose;
const progress = require('./Progress').schema;

const Section = new Schema({
    destroyStatus  : { type : Boolean, required : true },
    level  : { type : Number, required : true },
    vuln : { type : Number, required : true },   // 회사 별 첫 취약점 공격 인덱스
    vulnActive : { type : Boolean, required : true },
    attackStep : { type : Number, required : true },   // 성공한 공격 단계를 뜻함
    attack : { type : progress, required : true },
    response : { type : progress, required : true },
})

module.exports = mongoose.model('Section', Section); 