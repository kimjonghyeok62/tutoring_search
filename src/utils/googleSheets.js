
export const SHEET_ID = '1pHQNblzLHIE3Rfz9h622MXDLAAXtkyv4I06Zync2-Xk';
export const DATA_GID = '2090335200';  // 교습소 조회 자료 탭
export const PASSWORD_GID = '1813814045';

// ⚠️ 데이터 업데이트 시 아래 날짜를 변경하세요
// 형식: "YYYY. M. DD. (요일) 기준" (예: "2026. 1. 16. (금) 기준")
export const DATA_AS_OF = '2026. 1. 19. (월) 기준';


export async function fetchGoogleSheetData(gid) {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch data: ${response.statusText}`);
        }
        const txt = await response.text();
        return parseCSV(txt);
    } catch (error) {
        console.error("Error fetching Google Sheet:", error);
        throw error;
    }
}

// 데이터 기준일 반환 - 구글 시트 제목에서 자동으로 가져옴
export async function fetchSheetName() {
    try {
        // Google Sheets HTML 페이지에서 제목 추출
        const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`;
        const response = await fetch(url);
        const html = await response.text();

        // HTML에서 제목 추출 (예: "교습소 조회 자료 (2026.01.22. 기준)")
        const titleMatch = html.match(/<title>([^<]+)<\/title>/);
        if (titleMatch && titleMatch[1]) {
            const title = titleMatch[1];
            console.log('Sheet title:', title);

            // 제목에서 날짜 패턴 추출
            // 패턴 1: "2026.01.22. 기준" 형식 (점으로 구분, 월/일이 0으로 패딩됨)
            const dateMatch1 = title.match(/(\d{4})\.(\d{1,2})\.(\d{1,2})\.\s*기준/);
            if (dateMatch1) {
                const year = dateMatch1[1];
                const month = parseInt(dateMatch1[2], 10);
                const day = parseInt(dateMatch1[3], 10);

                // 요일 계산
                const date = new Date(year, month - 1, day);
                const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
                const weekday = weekdays[date.getDay()];

                const formattedDate = `${year}. ${month}. ${day}. (${weekday}) 기준`;
                console.log('Extracted and formatted date:', formattedDate);
                return formattedDate;
            }

            // 패턴 2: 이미 포맷된 형식 "YYYY. M. DD. (요일) 기준"
            const dateMatch2 = title.match(/(\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\.\s*\([^\)]+\)\s*기준)/);
            if (dateMatch2) {
                console.log('Extracted date:', dateMatch2[1]);
                return dateMatch2[1];
            }
        }
    } catch (error) {
        console.error("Error fetching sheet title:", error);
    }

    // 폴백: 상수 사용 (가장 안정적인 방법)
    console.log('Using fallback date from DATA_AS_OF constant');
    return DATA_AS_OF;
}


function parseCSV(text) {
    // Simple CSV parser handling quotas (basic implementation)
    // Assumes the first row is header.
    const rows = text.split('\n').map(row => row.trim()).filter(row => row);
    const headers = rows[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());

    const result = [];

    for (let i = 1; i < rows.length; i++) {
        // Handle commas inside quotes
        const row = rows[i];
        const values = [];
        let inQuote = false;
        let currentVal = '';

        for (let char of row) {
            if (char === '"') {
                inQuote = !inQuote;
            } else if (char === ',' && !inQuote) {
                values.push(currentVal.trim());
                currentVal = '';
            } else {
                currentVal += char;
            }
        }
        values.push(currentVal.trim());

        if (values.length !== headers.length) {
            // In case of parsing mismatch, simple fallback or skip?
            // Let's try to pad or truncate.
        }

        const obj = {};
        headers.forEach((header, index) => {
            obj[header] = values[index] ? values[index].replace(/^"|"$/g, '') : '';
        });
        result.push(obj);
    }
    return result;
}

export function transformAcademyData(rawRows) {
    console.log('transformAcademyData called with', rawRows.length, 'rows');

    // 첫 번째 행의 키를 로그로 출력하여 필드명 확인
    if (rawRows.length > 0) {
        console.log('First row keys:', Object.keys(rawRows[0]));
        console.log('First row sample:', rawRows[0]);
    }

    const tutoringMap = new Map();

    rawRows.forEach((row, index) => {
        const reportNum = (row['신고번호'] || '').trim();
        const name = (row['교습소명'] || '').trim();

        if (!name || !reportNum) {
            if (index < 5) { // 처음 5개만 로그 출력
                console.log(`Row ${index} skipped - name: "${name}", reportNum: "${reportNum}"`);
            }
            return;
        }

        // 교습소는 신고번호를 키로 사용 (같은 교습소가 여러 과정을 가질 수 있음)
        const key = `${reportNum}_${name}`;

        if (!tutoringMap.has(key)) {
            tutoringMap.set(key, {
                id: reportNum,
                name: name,
                category: row['분야구분'] || '교습소',
                field: row['분야구분'] || '',
                address: row['교습소주소'] || '',
                zip: row['우편번호'] || '',
                regDate: row['등록일'] || '',
                status: row['등록상태'] || '',
                statusDate: row['개소/휴소/폐소일'] || '',
                isMultiUse: row['다중이용업소여부'] || '',
                isBoarding: row['기숙학원여부'] || '',
                disclosure: row['수강료공개구분'] || '',
                ownership: row['건물소유'] || '',
                businessNumber: row['사업자등록번호'] || '',
                email: row['이메일주소'] || '',
                changeDate: row['변경일'] || '',
                founder: {
                    name: row['교습자-성명'] || '',
                    birth: '',  // 교습소 데이터에는 생년월일 없음
                    address: '',  // 지번주소는 제외 (개인 자택 주소)
                    phone: row['전화번호'] || '',
                    mobile: row['핸드폰'] || ''
                },
                facilities: {
                    buildingArea: '',  // 교습소에는 건물연면적 필드 없음
                    totalArea: row['총면적'] || '',
                    dedicatedArea: '',  // 교습소에는 전용면적 필드 없음
                    floors: row['총건물층수'] || '',
                    builtDate: row['준공일(사용승인일)'] || '',
                    capacityTemporary: row['일시수용능력인원'] || '',
                    capacityTotal: row['정원합계'] || ''
                },
                courses: [],
                insurances: [],
                inspections: []
            });
        }

        const tutoring = tutoringMap.get(key);

        // Add course if unique
        const course = {
            process: row['교습과정'] || '',
            subject: row['교습과목(반)'] || '',
            track: row['교습계열'] || '',
            target: row['교습대상'] || '',
            quota: row['정원'] || '',
            period: `${row['교습기간(개월)'] || '0'}개월 ${row['교습기간(일)'] || '0'}일`,
            periodMonths: row['교습기간(개월)'] || '',
            periodDays: row['교습기간(일)'] || '',
            time: row['총교습기간(분)'] || '',
            fee: row['교습비'] || '',
            feePerHour: row['교습비(시간당)'] || '',
            materialFee: row['교재비'] || '',
            mockExamFee: row['모의고사비'] || '',
            materialsCost: row['재료비'] || '',
            mealFee: row['급식비'] || '',
            snackFee: row['간식비'] || '',
            dormFee: row['기숙사비'] || '',
            transportFee: row['차량비'] || '',
            otherFee: row['기타비'] || '',
            uniformFee: row['피복비'] || '',
            otherFeesTotal: row['기타경비합계'] || '',
            totalFee: row['총교습비'] || '',
            totalFeePerHour: row['총교습비(시간당)'] || '',
            disclosureType: row['수강료공개구분'] || '',
            remarks: row['비고(교습과정)'] || ''
        };
        if (course.subject) {
            const isDuplicateCourse = tutoring.courses.some(c =>
                c.subject === course.subject &&
                c.process === course.process &&
                c.target === course.target
            );
            if (!isDuplicateCourse) tutoring.courses.push(course);
        }

        // Add insurance if unique
        const insurance = {
            type: row['보험가입여부'] || '',
            company: row['보험가입기관'] || '',
            otherType: row['보험가입종류기타명'] || '',
            contractor: row['계약업체명'] || '',
            policyNumber: row['계약번호'] || '',
            compensationPerPerson: row['인당배상금액'] || '',
            compensationPerAccident: row['사고당배상금액'] || '',
            medicalPerPerson: row['인당의료실비금액'] || '',
            joinDate: row['가입일자'] || '',
            startDate: row['보험시작일자'] || '',
            endDate: row['보험종료일자'] || ''
        };
        if (insurance.company || insurance.policyNumber || insurance.type) {
            const isDuplicateIns = tutoring.insurances.some(i =>
                i.policyNumber === insurance.policyNumber && insurance.policyNumber
            );
            if (!isDuplicateIns) tutoring.insurances.push(insurance);
        }

        // 교습소는 지도점검 데이터가 없는 것으로 보임
        // 필요시 추가 가능
    });

    const result = Array.from(tutoringMap.values());
    console.log('transformAcademyData result:', result.length, 'tutoring centers');
    if (result.length > 0) {
        console.log('First tutoring center:', result[0]);
    }

    return result;
}
