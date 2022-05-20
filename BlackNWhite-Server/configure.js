// Configure File
module.exports = {
    TOTAL_PITA : 100,

    // 공격 & 대응
    ATTACK_1 : { pita : [5, 6, 7, 8, 9], time : [5, 4, 3, 2, 1], name : "Reconnaissance"},
    ATTACK_2 : { pita : [5, 6, 7, 8, 9], time : [5, 4, 3, 2, 1], name : "Credential Access"},
    ATTACK_3 : { pita : [5, 6, 7, 8, 9], time : [5, 4, 3, 2, 1], name : "Discovery"},
    ATTACK_4 : { pita : [5, 6, 7, 8, 9], time : [5, 4, 3, 2, 1], name : "Collection"},
    ATTACK_5 : { pita : [5, 6, 7, 8, 9], time : [5, 4, 3, 2, 1], name : "Resouce Development"},
    ATTACK_6 : { pita : [5, 6, 7, 8, 9], time : [5, 4, 3, 2, 1], name : "Initial Access"},
    ATTACK_7 : { pita : [5, 6, 7, 8, 9], time : [5, 4, 3, 2, 1], name : "Execution"},
    ATTACK_8 : { pita : [5, 6, 7, 8, 9], time : [5, 4, 3, 2, 1], name : "Privilege Escalation"},
    ATTACK_9 : { pita : [5, 6, 7, 8, 9], time : [5, 4, 3, 2, 1], name : "Persistence"},
    ATTACK_10 : { pita : [5, 6, 7, 8, 9], time : [5, 4, 3, 2, 1], name : "Defense Evasion"},
    ATTACK_11 : { pita : [5, 6, 7, 8, 9], time : [5, 4, 3, 2, 1], name : "Command and Control"},
    ATTACK_12 : { pita : [5, 6, 7, 8, 9], time : [5, 4, 3, 2, 1], name : "Exfiltration"},
    ATTACK_13 : { pita : [5, 6, 7, 8, 9], time : [5, 4, 3, 2, 1], name : "Impact"},
    
    // 연구 & 모의해킹
    RESEARCH_1 : { pita : [5, 6, 7, 8, 9], time : [5, 4, 3, 2, 1], name : "Reconnaissance"},
    RESEARCH_2 : { pita : [5, 6, 7, 8, 9], time : [5, 4, 3, 2, 1], name : "Credential Access"},
    RESEARCH_3 : { pita : [5, 6, 7, 8, 9], time : [5, 4, 3, 2, 1], name : "Discovery"},
    RESEARCH_4 : { pita : [5, 6, 7, 8, 9], time : [5, 4, 3, 2, 1], name : "Collection"},
    RESEARCH_5 : { pita : [5, 6, 7, 8, 9], time : [5, 4, 3, 2, 1], name : "Resouce Development"},
    RESEARCH_6 : { pita : [5, 6, 7, 8, 9], time : [5, 4, 3, 2, 1], name : "Initial Access"},
    RESEARCH_7 : { pita : [5, 6, 7, 8, 9], time : [5, 4, 3, 2, 1], name : "Execution"},
    RESEARCH_8 : { pita : [5, 6, 7, 8, 9], time : [5, 4, 3, 2, 1], name : "Privilege Escalation"},
    RESEARCH_9 : { pita : [5, 6, 7, 8, 9], time : [5, 4, 3, 2, 1], name : "Persistence"},
    RESEARCH_10 : { pita : [5, 6, 7, 8, 9], time : [5, 4, 3, 2, 1], name : "Defense Evasion"},
    RESEARCH_11 : { pita : [5, 6, 7, 8, 9], time : [5, 4, 3, 2, 1], name : "Command and Control"},
    RESEARCH_12 : { pita : [5, 6, 7, 8, 9], time : [5, 4, 3, 2, 1], name : "Exfiltration"},
    RESEARCH_13 : { pita : [5, 6, 7, 8, 9], time : [5, 4, 3, 2, 1], name : "Impact"},
    
    GAME_TIME : 30, // 현재 단위 분, 추후 수정
    MAX_LEVEL : 5,
    BLACK_MIN_LEVEL : 0,
    WHITE_MIN_LEVEL : 1,
    
    WARNING_CNT : 3,
    
    // 사후관리
    UNBLOCK_INFO : { pita : 50, time : [15, 14, 13, 12, 11] },
    DETECTION_CNT_PER_LEVEL : [6, 5, 4, 3, 2],
    
    // 영역과 공격의 레벨 차에 따른 지연 시간
    DELAY_TIME_PERCENT : [1, 1.5, 1.8, -1, -1],
    
    // 유지보수
    MAINTENANCE_SECTION_INFO : { pita : [5, 6, 7, 8, 9], time : [5, 4, 3, 2, 1] },
    
    // 사전탐색
    EXPLORE_INFO : { pita : 10, time : 10 },
    
    // 수입원
    BLACK_INCOME : { pita : 50, time : 10 },
    WHITE_INCOME : { pita : 100, time : 10 }
    
    
    // const COMPANY_1 = { name : "" , sectionVuln=Rand_Vuln(sectionNum) }; // section 인덱스 = 영역 idx
    // const COMPANY_2 = { name : "" , section=["ATTACK_2", "ATTACK_3",  "ATTACK_1"] };
    
    /*
    function Rand_Vuln(Numsection){
        var vulnArr = [];
    
        for(var i=0; i<Numsection; i++) {
                parseInt(Math.random() * 4)
                vulnArr.append("ATTACK_" + i.)
        }
    
        return vulnArr
    }
    */
}