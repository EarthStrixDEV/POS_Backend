const express = require('express');
const cors = require('cors');
const ftpClient = require('ftp');
const nodemailer = require('nodemailer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { request } = require('http');
const app = express();
require('dotenv').config()
const host = process.env.HOST;
const user = process.env.USER;
const password = process.env.PASSWORD;

app.use(cors());
app.use(express.json()); // เพิ่ม middleware เพื่อให้ Express สามารถอ่านข้อมูล JSON จาก body ของ request ได้
app.use(express.urlencoded({
    extended: true
}))

const callUUID = async () => {
    try {
        const response = await axios.get('http://legendaryknights.ddns.net:8000/');
        console.log(response.data);
        return response.data;
    } catch (error) {
        console.log(error);
        throw error; // ส่ง error ออกไปให้ catch ด้านนอกจัดการ
    }
};
/*
// อ่านข้อมูลลงใน ftp server
app.get('/readFileFromFTP/:filename', (req, res) => {
    const ftp = new ftpClient();
    ftp.connect({
        host: host, 
        user: user,
        password: password
    });

    ftp.on('ready', () => {
        const filename = req.params.filename; // รับชื่อไฟล์จาก parameter ใน URL

        ftp.get(filename, (err, stream) => {
            if (err) {
                console.error("Error occurred:", err);
                res.status(500).send("Internal Server Error");
            } else {
                let data = '';

                stream.on('data', chunk => {
                    data += chunk.toString(); // เพิ่มข้อมูลที่ได้จาก stream ไปยังตัวแปร data
                });

                stream.on('end', () => {
                    ftp.end(); // หลังจากอ่านข้อมูลเสร็จสิ้น ปิดการเชื่อมต่อ FTP
                    console.log("Read successful.");

                    // ส่งข้อมูลกลับไปยัง client
                    res.send(data);
                });
            }
        });
    });
});

// เขียนข้อมูลลงใน FTP server ในรูปแบบ JSON
app.post('/writeJsonFileToFTP', (req, res) => {
    const ftp = new ftpClient();
    const filename = req.body.filename; // รับชื่อไฟล์จาก body ของ request
    const jsonData = req.body.data; // รับข้อมูล JSON จาก body ของ request

    ftp.connect({
        host: host, 
        user: user,
        password: password
    });

    ftp.on('ready', () => {
        // ตรวจสอบว่าไฟล์ที่จะเขียนมีอยู่แล้วหรือไม่
        ftp.size(filename, (err, size) => {
            if (!err) {
                console.log("File already exists:", filename);
                res.send("File already exists");
                return;
            }
    
            const jsonString = JSON.stringify(jsonData); // แปลงข้อมูล JSON เป็น string
            ftp.put(Buffer.from(jsonString), filename, (err) => {
                if (err) {
                    console.error("Error occurred:", err);
                    res.status(500).send("Internal Server Error");
                } else {
                    console.log("Write successful");
                    ftp.end(); // ปิดการเชื่อมต่อ FTP
                    res.status(200).send("Write successful");
                }
            });
        });
    });
});
*/
app.post('/writeJsonFileToFolderDatabaseInFTP', async(req, res) => {
    const ftp = new ftpClient();
    
    try {
        let uuid = await callUUID();

        if(uuid.status == false){
            if(uuid.message == "กรุณาแนบบัตร"){
                res.status(200).send("กรุณาแนบบัตร")
                return;
            }
            else if(uuid.message == "ไม่พบเครื่องอ่านบัตร"){
                res.status(200).send("ไม่พบเครื่องอ่านบัตร")
                return;
            }
        }

        const studentID = req.body.studentID;
        const username = req.body.username;
        const firstname = req.body.firstname;
        const lastname = req.body.lastname;
        const cash = req.body.cash;
        const point = req.body.point;

        const jsonData = {
            studentID: studentID,
            username: username,
            firstname: firstname,
            lastname: lastname,
            cash: cash,
            point: point
        };

        const folderName = 'DATABASE'; // ชื่อโฟลเดอร์ที่ต้องการสร้างไฟล์ JSON ในนี้
        const filename = folderName + '/' + `${uuid.message}.json`; // ระบุพาธของไฟล์ที่รวมถึงชื่อโฟลเดอร์

        ftp.connect({
            host: host, 
            user: user,
            password: password
        });

        ftp.on('ready', () => {
            // ตรวจสอบว่าโฟลเดอร์ "DATABASE" มีอยู่หรือไม่
            ftp.list('/', (err, list) => {
                if (err) {
                    console.error("Error occurred while checking folder:", err);
                    res.status(500).send("Internal Server Error");
                    return;
                }

                // ตรวจสอบว่าโฟลเดอร์ "DATABASE" มีอยู่หรือไม่
                const folderExists = list.some(item => item.type === 'd' && item.name === folderName);

                // ถ้าโฟลเดอร์ยังไม่มีอยู่ ให้สร้างโฟลเดอร์ "DATABASE" ก่อน
                if (!folderExists) {
                    ftp.mkdir(folderName, (err) => {
                        if (err) {
                            console.error("Error occurred while creating folder:", err);
                            res.status(500).send("Internal Server Error");
                            return;
                        }

                        console.log("Folder creation successful:", folderName);
                        // ทำการสร้างไฟล์ JSON หลังจากสร้างโฟลเดอร์เสร็จสิ้น
                        createJsonFile();
                    });
                } else {
                    // ถ้าโฟลเดอร์ "DATABASE" มีอยู่แล้ว ให้ทำการสร้างไฟล์ JSON ทันที
                    createJsonFile();
                }
            });
        });

        function createJsonFile() {
            ftp.size(filename, (err, size) => {
                const jsonString = JSON.stringify(jsonData); // แปลงข้อมูล JSON เป็น string
                if (!err) {
                    console.log("File already exists:", filename);
                    res.send("File already exists");
                    return;
                }

                ftp.put(Buffer.from(jsonString), filename, (err) => {
                    if (err) {
                        console.error("Error occurred while writing JSON file:", err);
                        res.status(500).send("Internal Server Error");
                    } else {
                        console.log("Write successful:", filename);
                        ftp.end(); // ปิดการเชื่อมต่อ FTP
                        res.status(200).send("Write successful");
                    }
                });
            });
        }
    } catch (error) {
        console.error("Error occurred:", error);
        res.status(500).send("Internal Server Error");
    }
});


app.post('/topUpCashCard', async(req, res) => {
    const ftp = new ftpClient();
    let cash = req.body.cash;
    try{
        let uuid = await callUUID();

        if(uuid.status == false){
            if(uuid.message == "กรุณาแนบบัตร"){
                res.status(200).send("กรุณาแนบบัตร")
                return;
            }
            else if(uuid.message == "ไม่พบเครื่องอ่านบัตร"){
                res.status(200).send("ไม่พบเครื่องอ่านบัตร")
                return;
            }
        }

        ftp.connect({
            host: host, 
            user: user,
            password: password
        });
    
        ftp.on('ready', () => {
            const folderName = 'DATABASE';
            const filename = folderName + `/${uuid.message}.json`; // ระบุพาธของไฟล์ที่รวมถึงชื่อโฟลเดอร์และชื่อไฟล์
    
            ftp.get(filename, (err, stream) => {
                if (err) {
                    //console.error("Error occurred while reading file:", err);
                    //res.status(500).send("Internal Server Error");
                    res.status(200).send("Not member, please sign up first")
                    return;
                }
    
                let data = '';
    
                stream.on('data', chunk => {
                    data += chunk.toString(); // เพิ่มข้อมูลที่ได้จาก stream ไปยังตัวแปร data
                });
    
                stream.on('end', () => {
                    try {
                        const jsonData = JSON.parse(data); // แปลงข้อมูล JSON จาก string เป็น object
                        
                        // อัปเดตข้อมูลใน JSON
                        jsonData.cash += cash; // ลดจำนวนเงินในบัญชี
    
                        // แปลงข้อมูล JSON กลับเป็น string
                        const updatedData = JSON.stringify(jsonData);
    
                        // เขียนข้อมูลลงในไฟล์บน FTP server
                        ftp.put(Buffer.from(updatedData), filename, (err) => {
                            if (err) {
                                console.error("Error occurred while updating file:", err);
                                res.status(500).send("Internal Server Error");
                            } else {
                                console.log(`Update data ${filename} successfully`);
                                res.status(200).json(jsonData); // ส่งข้อมูล JSON กลับไปยังผู้ใช้
                            }
                            ftp.end(); // ปิดการเชื่อมต่อ FTP
                        });
                    } catch (error) {
                        console.error("Error occurred while parsing JSON:", error);
                        res.status(500).send("Internal Server Error");
                    }
                });
            });
        });
    } catch (error) {
        console.error("Error occurred:", error);
        res.status(500).send("Internal Server Error");
    }

    
});

app.post('/updateDataNisit', async(req, res) => {
    const ftp = new ftpClient();
    let cash = req.body.cash;

    try{
        let uuid = await callUUID();

        if(uuid.status == false){
            if(uuid.message == "กรุณาแนบบัตร"){
                res.status(200).send("กรุณาแนบบัตร")
                return;
            }
            else if(uuid.message == "ไม่พบเครื่องอ่านบัตร"){
                res.status(200).send("ไม่พบเครื่องอ่านบัตร")
                return;
            }
        }

        ftp.connect({
            host: host, 
            user: user,
            password: password
        });
    
        ftp.on('ready', () => {
            const folderName = 'DATABASE';
            const filename = folderName + `/${uuid.message}.json`; // ระบุพาธของไฟล์ที่รวมถึงชื่อโฟลเดอร์และชื่อไฟล์
    
            ftp.get(filename, (err, stream) => {
                if (err) {
                    //console.error("Error occurred while reading file:", err);
                    //res.status(500).send("Internal Server Error");
                    res.status(200).send("Not member, please sign up first")
                    return;
                }
    
                let data = '';
    
                stream.on('data', chunk => {
                    data += chunk.toString(); // เพิ่มข้อมูลที่ได้จาก stream ไปยังตัวแปร data
                });
    
                stream.on('end', () => {
                    try {
                        const jsonData = JSON.parse(data); // แปลงข้อมูล JSON จาก string เป็น object
                        // แก้ไขค่า cash และ point
                        if (jsonData.cash - cash < 0) {
                            console.log("Not enough money")
                            res.status(200).send("Not enough money");
                            ftp.end();
                            return;
                        }
                        
                        // อัปเดตข้อมูลใน JSON
                        //let point = cash * 5 / 100; // ได้แต้ม 5% จากราคาชำระ
                        jsonData.cash -= cash; // ลดจำนวนเงินในบัญชี
                        jsonData.point += point; // เพิ่มจำนวนแต้ม
    
                        // แปลงข้อมูล JSON กลับเป็น string
                        const updatedData = JSON.stringify(jsonData);
    
                        // เขียนข้อมูลลงในไฟล์บน FTP server
                        ftp.put(Buffer.from(updatedData), filename, (err) => {
                            if (err) {
                                console.error("Error occurred while updating file:", err);
                                res.status(500).send("Internal Server Error");
                            } else {
                                console.log(`Update data ${filename} successfully`);
                                res.status(200).json(jsonData); // ส่งข้อมูล JSON กลับไปยังผู้ใช้
                            }
                            ftp.end(); // ปิดการเชื่อมต่อ FTP
                        });
                    } catch (error) {
                        console.error("Error occurred while parsing JSON:", error);
                        res.status(500).send("Internal Server Error");
                    }
                });
            });
        });
        
    } catch (error) {
        console.error("Error occurred:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.get('/retrieveDataNisit', (req, res) => {
    const ftp = new ftpClient();
    const data = [];

    ftp.connect({
        host: host, 
        user: user,
        password: password
    });

    ftp.on('ready', () => {
        ftp.list('/DATABASE', (err, list) => {
            if (err) {
                console.error("Error occurred while listing files:", err);
                res.status(500).send("Internal Server Error");
                return;
            }
        
            // วนลูปผ่านรายการไฟล์ในโฟลเดอร์ "DATABASE"
            for (let i = 0; i < list.length; i++) {
                const item = list[i];
                // ตรวจสอบว่าไฟล์นี้เป็นไฟล์ที่ต้องการหรือไม่
                if (item.type === '-') { // ตรวจสอบว่าเป็นไฟล์ (ไม่ใช่โฟลเดอร์)
                    const filename = item.name;
                    const filepath = '/DATABASE/' + filename;
        
                    // อ่านเนื้อหาของไฟล์
                    ftp.get(filepath, (err, stream) => {
                        if (err) {
                            //console.error("Error occurred while reading file:", err);
                            // สามารถทำการให้การตอบกลับอื่น ๆ หรือการจัดการข้อผิดพลาดตามที่คุณต้องการได้
                            return;
                        }
        
                        // เก็บเนื้อหาของไฟล์ไว้ใน buffer
                        let buffer = Buffer.alloc(0);
                        stream.on('data', (chunk) => {
                            buffer = Buffer.concat([buffer, chunk]);
                        });
        
                        stream.on('end', () => {
                            const fileContent = buffer.toString();
                            console.log(`File content of ${filename}:`, fileContent);
                            data.push(fileContent);
                            
                            // ตรวจสอบว่าเสร็จสิ้นการดึงข้อมูลทั้งหมดหรือไม่ก่อนส่ง response
                            if (data.length === list.length) {
                                const parsedData = data.map(item => JSON.parse(item));
                                res.status(200).send(parsedData);
                            }
                        });
                    });
                }
            }
        });
    });
});

app.post('/retrieveDataNisitWithUUID', async(req, res) => {
    const ftp = new ftpClient();
    try{
        let uuid = await callUUID();

        if(uuid.status == false){
            if(uuid.message == "กรุณาแนบบัตร"){
                res.status(200).send("กรุณาแนบบัตร")
                return;
            }
            else if(uuid.message == "ไม่พบเครื่องอ่านบัตร"){
                res.status(200).send("ไม่พบเครื่องอ่านบัตร")
                return;
            }
        }

        ftp.connect({
            host: host, 
            user: user,
            password: password
        });
    
        ftp.on('ready', () => {
            const folderName = 'DATABASE';
            const filename = folderName + `/${uuid.message}.json`; // ระบุพาธของไฟล์ที่รวมถึงชื่อโฟลเดอร์และชื่อไฟล์
    
            ftp.get(filename, (err, stream) => {
                if (err) {
                    //console.error("Error occurred while reading file:", err);
                    //res.status(500).send("Internal Server Error");
                    res.status(200).send("Not member, please sign up first")
                    return;
                }
    
                let data = '';
    
                stream.on('data', chunk => {
                    data += chunk.toString(); // เพิ่มข้อมูลที่ได้จาก stream ไปยังตัวแปร data
                });
    
                stream.on('end', () => {
                    try {
                        const jsonData = JSON.parse(data); // แปลงข้อมูล JSON จาก string เป็น object
                        console.log(`retrieve data ${filename} successfully`);
                        res.status(200).json(jsonData); // ส่งข้อมูล JSON กลับไปยังผู้ใช้
                        ftp.end();
                    } catch (error) {
                        console.error("Error occurred while parsing JSON:", error);
                        res.status(500).send("Internal Server Error");
                    }
                });
            });
        });
    } catch (error) {
        console.error("Error occurred:", error);
        res.status(500).send("Internal Server Error");
    }
    
    
});

let sentOTP;

app.post('/verifyOTP', (req, res) => {
    const receivedOTP = req.body.receivedOTP; // otp ที่ผู้ใช้ส่งกลับมา
    console.log(sentOTP)
    // เปรียบเทียบ otp ที่ผู้ใช้ส่งกลับมากับ otp ที่ส่งไป
    if (receivedOTP === sentOTP) {
        res.status(200).send("OTP match. User verified successfully.");
    } else {
        res.status(200).send("OTP do not match. User verification failed.");
    }
});

app.post('/sendSMTPToEmail', async (req, res) => {
    const emailSender = req.body.emailSender;
    const passwordSender = req.body.passwordSender;
    const usernameReceiver = req.body.usernameReceiver;

    function generateRandomCode() {
        const min = 100000;
        const max = 999999;
        return (Math.floor(min + Math.random() * (max - min))).toString();
    }

    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: emailSender,
                pass: passwordSender
            }
        });

        const verification = await transporter.verify();
        if (verification) {
            console.log("Connect server successfully");

            // สร้างรหัสสุ่ม 6 หลักที่ประกอบด้วยตัวเลขเท่านั้น
            const randomOTP = generateRandomCode();

            const mailOptions = {
                from: emailSender,
                to: `${usernameReceiver}@ku.th`,
                subject: `OTP from ${emailSender}`,
                text: `Your OTP is: ${randomOTP}`
            };

            const info = await transporter.sendMail(mailOptions);
            console.log("Send Mail Successfully:", info.response);

            sentOTP = randomOTP;

            res.status(200).send(randomOTP);
        } else {
            console.error("Incorrect account or password");
            res.status(500).send("Incorrect account or password");
        }
    } catch (err) {
        console.error("Error with file:", err);
        res.status(500).send("Internal Server Error");
    }
});

app.get('/retrieveShop', (req, res) => {
    // กำหนดพาธของไฟล์ shop.json
    const filePath = path.join(__dirname, 'shop.json');

    // อ่านข้อมูลจากไฟล์ shop.json
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error("Error reading file:", err);
            res.status(500).send("Internal Server Error");
            return;
        }

        try {
            // แปลงข้อมูล JSON เป็น Object
            const shopData = JSON.parse(data);
            res.status(200).json(shopData.payload); // ส่ง response ค่าข้อมูลของร้านค้ากลับไป
        } catch (error) {
            console.error("Error parsing JSON:", error);
            res.status(500).send("Internal Server Error");
        }
    });
});

app.post('/createTransactionShop', async(req, res) => {
    const ftp = new ftpClient();
    
    try {
        const studentID = req.body.studentID;
        const point = req.body.point;
        const shopID = req.body.shopID;
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = (currentDate.getMonth() + 1).toString().padStart(2, '0'); // เพิ่ม 1 เนื่องจาก getMonth() เริ่มจาก 0
        const day = currentDate.getDate().toString().padStart(2, '0');
        const formattedCurrentDate = `${year}-${month}-${day}`; // ใส่ backtick (`) และเพิ่ม ${} ครอบตัวแปร

        const jsonData = {
            transaction:[
                {
                    studentID: studentID,
                    point: point,
                    timestamp: formattedCurrentDate
                }
            ]
            
        };

        const folderName = 'SHOP'; // ชื่อโฟลเดอร์ที่ต้องการสร้างไฟล์ JSON ในนี้
        const filename = folderName + '/' + `${shopID}.json`; // ระบุพาธของไฟล์ที่รวมถึงชื่อโฟลเดอร์

        ftp.connect({
            host: host, 
            user: user,
            password: password
        });

        ftp.on('ready', () => {
            // ตรวจสอบว่าโฟลเดอร์ "SHOP" มีอยู่หรือไม่
            ftp.list('/', (err, list) => {
                if (err) {
                    console.error("Error occurred while checking folder:", err);
                    res.status(500).send("Internal Server Error");
                    return;
                }

                // ตรวจสอบว่าโฟลเดอร์ "SHOP" มีอยู่หรือไม่
                const folderExists = list.some(item => item.type === 'd' && item.name === folderName);

                // ถ้าโฟลเดอร์ยังไม่มีอยู่ ให้สร้างโฟลเดอร์ "SHOP" ก่อน
                if (!folderExists) {
                    ftp.mkdir(folderName, (err) => {
                        if (err) {
                            console.error("Error occurred while creating folder:", err);
                            res.status(500).send("Internal Server Error");
                            return;
                        }

                        console.log("Folder creation successful:", folderName);
                        // ทำการสร้างไฟล์ JSON หลังจากสร้างโฟลเดอร์เสร็จสิ้น
                        createJsonFile();
                    });
                } else {
                    // ถ้าโฟลเดอร์ "DATABASE" มีอยู่แล้ว ให้ทำการสร้างไฟล์ JSON ทันที
                    createJsonFile();
                }
            });
        });

        function updateJsonFile(){
            ftp.get(filename, (err, stream) => {
                if (err) {
                    //console.error("Error occurred while reading file:", err);
                    //res.status(500).send("Internal Server Error");
                    res.status(200).send("Not member, please sign up first")
                    return;
                }
    
                let data = '';
    
                stream.on('data', chunk => {
                    data += chunk.toString(); // เพิ่มข้อมูลที่ได้จาก stream ไปยังตัวแปร data
                });
    
                stream.on('end', () => {
                    try {
                        let jsonDataNew = JSON.parse(data); // แปลงข้อมูล JSON จาก string เป็น object
                        console.log(jsonDataNew);

                        let isUpdated = false;
                        jsonDataNew.transaction.forEach(element => {
                            if(element.studentID == studentID){
                                element.point+=point;
                                isUpdated = true;
                                return;
                            }
                        });

                        if(!isUpdated){
                            jsonDataNew.transaction.push({
                                studentID: studentID,
                                point: point,
                                timestamp: formattedCurrentDate
                            });
                        }

    
                        // แปลงข้อมูล JSON กลับเป็น string
                        const updatedData = JSON.stringify(jsonDataNew);
    
                        // เขียนข้อมูลลงในไฟล์บน FTP server
                        ftp.put(Buffer.from(updatedData), filename, (err) => {
                            if (err) {
                                console.error("Error occurred while updating file:", err);
                                res.status(500).send("Internal Server Error");
                            } else {
                                console.log(`Update data ${filename} successfully`);
                                res.status(200).json(jsonDataNew); // ส่งข้อมูล JSON กลับไปยังผู้ใช้
                            }
                            ftp.end(); // ปิดการเชื่อมต่อ FTP
                        });
                    } catch (error) {
                        console.error("Error occurred while parsing JSON:", error);
                        res.status(500).send("Internal Server Error");
                    }
                });
            });
        }

        function createJsonFile() {
            ftp.size(filename, (err, size) => {
                const jsonString = JSON.stringify(jsonData); // แปลงข้อมูล JSON เป็น string
                if (!err) {
                    updateJsonFile();
                    return;
                }

                ftp.put(Buffer.from(jsonString), filename, (err) => {
                    if (err) {
                        console.error("Error occurred while writing JSON file:", err);
                        res.status(500).send("Internal Server Error");
                    } else {
                        console.log("Write successful:", filename);
                        ftp.end(); // ปิดการเชื่อมต่อ FTP
                        res.status(200).send("Write successful");
                    }
                });
            });
        }
    } catch (error) {
        console.error("Error occurred:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.post('/createTransactionUsePoint',async(req ,res) => {
    const ftp = new ftpClient();
    
    try {
        let uuid = await callUUID();

        if(uuid.status == false){
            if(uuid.message == "กรุณาแนบบัตร"){
                res.status(200).send("กรุณาแนบบัตร")
                return;
            }
            else if(uuid.message == "ไม่พบเครื่องอ่านบัตร"){
                res.status(200).send("ไม่พบเครื่องอ่านบัตร")
                return;
            }
        }

        const {shopID ,product ,product_point ,product_count} = req.body;

        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = (currentDate.getMonth() + 1).toString().padStart(2, '0'); // เพิ่ม 1 เนื่องจาก getMonth() เริ่มจาก 0
        const day = currentDate.getDate().toString().padStart(2, '0');
        const formattedCurrentDate = `${year}-${month}-${day}`; // ใส่ backtick (`) และเพิ่ม ${} ครอบตัวแปร

        const jsonData = {
            transaction:[
                {
                    shopID: shopID,
                    product: product,
                    product_point: product_point,
                    product_count: product_count,
                    timestamp: formattedCurrentDate
                }
            ]
        };

        const folderName = 'REDEEM'; // ชื่อโฟลเดอร์ที่ต้องการสร้างไฟล์ JSON ในนี้
        const filename = folderName + '/' + `${uuid.message}.json`; // ระบุพาธของไฟล์ที่รวมถึงชื่อโฟลเดอร์

        const filename_nisit = 'DATABASE' + '/' + `${uuid.message}.json`;

        ftp.connect({
            host: host, 
            user: user,
            password: password
        });

        ftp.on('ready', () => {
            // ตรวจสอบว่าโฟลเดอร์ "PAYMENT" มีอยู่หรือไม่
            ftp.list('/', (err, list) => {
                if (err) {
                    console.error("Error occurred while checking folder:", err);
                    res.status(500).send("Internal Server Error");
                    return;
                }

                // ตรวจสอบว่าโฟลเดอร์ "PAYMENT" มีอยู่หรือไม่
                const folderExists = list.some(item => item.type === 'd' && item.name === folderName);

                // ถ้าโฟลเดอร์ยังไม่มีอยู่ ให้สร้างโฟลเดอร์ "PAYMENT" ก่อน
                if (!folderExists) {
                    ftp.mkdir(folderName, (err) => {
                        if (err) {
                            console.error("Error occurred while creating folder:", err);
                            res.status(500).send("Internal Server Error");
                            return;
                        }

                        console.log("Folder creation successful:", folderName);
                        // ทำการสร้างไฟล์ JSON หลังจากสร้างโฟลเดอร์เสร็จสิ้น
                        createJsonFile();
                    });
                } else {
                    // ถ้าโฟลเดอร์ "PAYMENT" มีอยู่แล้ว ให้ทำการสร้างไฟล์ JSON ทันที
                    createJsonFile();
                }
            });
        });

        function updateJsonFile(){
            ftp.get(filename, (err, stream) => {
                if (err) {
                    //console.error("Error occurred while reading file:", err);
                    //res.status(500).send("Internal Server Error");
                    res.status(200).send("Not member, please sign up first")
                    return;
                }
    
                let data = '';
    
                stream.on('data', chunk => {
                    data += chunk.toString(); // เพิ่มข้อมูลที่ได้จาก stream ไปยังตัวแปร data
                });
    
                stream.on('end', () => {
                    try {
                        let jsonDataNew = JSON.parse(data); // แปลงข้อมูล JSON จาก string เป็น object
                        console.log(jsonDataNew);
                        jsonDataNew.transaction.push({
                            shopID: shopID,
                            product: product,
                            product_point: product_point,
                            product_count: product_count,
                            timestamp: formattedCurrentDate
                        });

                        updateNisitData();

                        // แปลงข้อมูล JSON กลับเป็น string
                        const updatedData = JSON.stringify(jsonDataNew);
    
                        // เขียนข้อมูลลงในไฟล์บน FTP server
                        ftp.put(Buffer.from(updatedData), filename, (err) => {
                            if (err) {
                                console.error("Error occurred while updating file:", err);
                                res.status(500).send("Internal Server Error");
                            } else {
                                console.log(`Update data ${filename} successfully`);
                                res.status(200).json(jsonDataNew); // ส่งข้อมูล JSON กลับไปยังผู้ใช้
                            }
                            ftp.end(); // ปิดการเชื่อมต่อ FTP
                        });
                    } catch (error) {
                        console.error("Error occurred while parsing JSON:", error);
                        res.status(500).send("Internal Server Error");
                    }
                });
            });
        }

        function updateNisitData() {
            ftp.get(filename_nisit ,(err ,stream) => {
                if (err) {
                    //console.error("Error occurred while reading file:", err);
                    //res.status(500).send("Internal Server Error");
                    res.status(200).send("Not member, please sign up first")
                    return;
                }
    
                let data = '';
    
                stream.on('data', chunk => {
                    data += chunk.toString(); // เพิ่มข้อมูลที่ได้จาก stream ไปยังตัวแปร data
                });

                stream.on('end', () => {
                    try {
                        let jsonDataNew = JSON.parse(data); // แปลงข้อมูล JSON จาก string เป็น object
                        console.log(jsonDataNew);

                        jsonDataNew.point -= (product_point * product_count)

                        // แปลงข้อมูล JSON กลับเป็น string
                        const updatedData = JSON.stringify(jsonDataNew);
    
                        // เขียนข้อมูลลงในไฟล์บน FTP server
                        ftp.put(Buffer.from(updatedData), filename, (err) => {
                            if (err) {
                                console.error("Error occurred while updating file:", err);
                                res.status(500).send("Internal Server Error");
                            } else {
                                console.log(`Update data ${filename} successfully`);
                                res.status(200).json(jsonDataNew); // ส่งข้อมูล JSON กลับไปยังผู้ใช้
                            }
                            ftp.end(); // ปิดการเชื่อมต่อ FTP
                        });
                    } catch (error) {
                        console.error("Error occurred while parsing JSON:", error);
                        res.status(500).send("Internal Server Error");
                    }
                });
            })
        }

        function createJsonFile() {
            ftp.size(filename, (err, size) => {
                const jsonString = JSON.stringify(jsonData); // แปลงข้อมูล JSON เป็น string
                if (!err) {
                    updateJsonFile();
                    return;
                }

                ftp.put(Buffer.from(jsonString), filename, (err) => {
                    if (err) {
                        console.error("Error occurred while writing JSON file:", err);
                        res.status(500).send("Internal Server Error");
                    } else {
                        console.log("Write successful:", filename);
                        ftp.end(); // ปิดการเชื่อมต่อ FTP
                        res.status(200).send("Write successful");
                    }
                });
            });
        }
    } catch (error) {
        console.error("Error occurred:", error);
        res.status(500).send("Internal Server Error");
    }
})

app.post('/createTransactionPayment', async(req, res) => {
    const ftp = new ftpClient();
    
    try {
        let uuid = await callUUID();

        if(uuid.status == false){
            if(uuid.message == "กรุณาแนบบัตร"){
                res.status(200).send("กรุณาแนบบัตร")
                return;
            }
            else if(uuid.message == "ไม่พบเครื่องอ่านบัตร"){
                res.status(200).send("ไม่พบเครื่องอ่านบัตร")
                return;
            }
        }

        const product = req.body.product;
        const cash = req.body.cash;
        const point = req.body.point;
        const shopID = req.body.shopID;

        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = (currentDate.getMonth() + 1).toString().padStart(2, '0'); // เพิ่ม 1 เนื่องจาก getMonth() เริ่มจาก 0
        const day = currentDate.getDate().toString().padStart(2, '0');
        const formattedCurrentDate = `${year}-${month}-${day}`; // ใส่ backtick (`) และเพิ่ม ${} ครอบตัวแปร

        const jsonData = {
            transaction:[
                {
                    shopID: shopID,
                    product: product,
                    cash: cash,
                    point: point,
                    timestamp: formattedCurrentDate
                }
            ]
            
        };

        const folderName = 'PAYMENT'; // ชื่อโฟลเดอร์ที่ต้องการสร้างไฟล์ JSON ในนี้
        const filename = folderName + '/' + `${uuid.message}.json`; // ระบุพาธของไฟล์ที่รวมถึงชื่อโฟลเดอร์

        ftp.connect({
            host: host, 
            user: user,
            password: password
        });

        ftp.on('ready', () => {
            // ตรวจสอบว่าโฟลเดอร์ "PAYMENT" มีอยู่หรือไม่
            ftp.list('/', (err, list) => {
                if (err) {
                    console.error("Error occurred while checking folder:", err);
                    res.status(500).send("Internal Server Error");
                    return;
                }

                // ตรวจสอบว่าโฟลเดอร์ "PAYMENT" มีอยู่หรือไม่
                const folderExists = list.some(item => item.type === 'd' && item.name === folderName);

                // ถ้าโฟลเดอร์ยังไม่มีอยู่ ให้สร้างโฟลเดอร์ "PAYMENT" ก่อน
                if (!folderExists) {
                    ftp.mkdir(folderName, (err) => {
                        if (err) {
                            console.error("Error occurred while creating folder:", err);
                            res.status(500).send("Internal Server Error");
                            return;
                        }

                        console.log("Folder creation successful:", folderName);
                        // ทำการสร้างไฟล์ JSON หลังจากสร้างโฟลเดอร์เสร็จสิ้น
                        createJsonFile();
                    });
                } else {
                    // ถ้าโฟลเดอร์ "PAYMENT" มีอยู่แล้ว ให้ทำการสร้างไฟล์ JSON ทันที
                    createJsonFile();
                }
            });
        });

        function updateJsonFile(){
            ftp.get(filename, (err, stream) => {
                if (err) {
                    //console.error("Error occurred while reading file:", err);
                    //res.status(500).send("Internal Server Error");
                    res.status(200).send("Not member, please sign up first")
                    return;
                }
    
                let data = '';
    
                stream.on('data', chunk => {
                    data += chunk.toString(); // เพิ่มข้อมูลที่ได้จาก stream ไปยังตัวแปร data
                });
    
                stream.on('end', () => {
                    try {
                        let jsonDataNew = JSON.parse(data); // แปลงข้อมูล JSON จาก string เป็น object
                        console.log(jsonDataNew);
                        jsonDataNew.transaction.push({
                            shopID: shopID,
                            product: product,
                            cash: cash,
                            point: point,
                            timestamp: formattedCurrentDate
                        });
    
                        // แปลงข้อมูล JSON กลับเป็น string
                        const updatedData = JSON.stringify(jsonDataNew);
    
                        // เขียนข้อมูลลงในไฟล์บน FTP server
                        ftp.put(Buffer.from(updatedData), filename, (err) => {
                            if (err) {
                                console.error("Error occurred while updating file:", err);
                                res.status(500).send("Internal Server Error");
                            } else {
                                console.log(`Update data ${filename} successfully`);
                                res.status(200).json(jsonDataNew); // ส่งข้อมูล JSON กลับไปยังผู้ใช้
                            }
                            ftp.end(); // ปิดการเชื่อมต่อ FTP
                        });
                    } catch (error) {
                        console.error("Error occurred while parsing JSON:", error);
                        res.status(500).send("Internal Server Error");
                    }
                });
            });
        }

        function createJsonFile() {
            ftp.size(filename, (err, size) => {
                const jsonString = JSON.stringify(jsonData); // แปลงข้อมูล JSON เป็น string
                if (!err) {
                    updateJsonFile();
                    return;
                }

                ftp.put(Buffer.from(jsonString), filename, (err) => {
                    if (err) {
                        console.error("Error occurred while writing JSON file:", err);
                        res.status(500).send("Internal Server Error");
                    } else {
                        console.log("Write successful:", filename);
                        ftp.end(); // ปิดการเชื่อมต่อ FTP
                        res.status(200).send("Write successful");
                    }
                });
            });
        }
    } catch (error) {
        console.error("Error occurred:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.post('/createTransactionTopUp', async(req, res) => {
    const ftp = new ftpClient();
    
    try {
        let uuid = await callUUID();

        if(uuid.status == false){
            if(uuid.message == "กรุณาแนบบัตร"){
                res.status(200).send("กรุณาแนบบัตร")
                return;
            }
            else if(uuid.message == "ไม่พบเครื่องอ่านบัตร"){
                res.status(200).send("ไม่พบเครื่องอ่านบัตร")
                return;
            }
        }

        const {cash} = req.body;

        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = (currentDate.getMonth() + 1).toString().padStart(2, '0'); // เพิ่ม 1 เนื่องจาก getMonth() เริ่มจาก 0
        const day = currentDate.getDate().toString().padStart(2, '0');
        const formattedCurrentDate = `${year}-${month}-${day}`; // ใส่ backtick (`) และเพิ่ม ${} ครอบตัวแปร

        const jsonData = {
            transaction:[
                {
                    cash: cash,
                    timestamp: formattedCurrentDate
                }
            ]
            
        };

        const folderName = 'TOPUP'; // ชื่อโฟลเดอร์ที่ต้องการสร้างไฟล์ JSON ในนี้
        const filename = folderName + '/' + `${uuid.message}.json`; // ระบุพาธของไฟล์ที่รวมถึงชื่อโฟลเดอร์

        ftp.connect({
            host: host, 
            user: user,
            password: password
        });

        ftp.on('ready', () => {
            // ตรวจสอบว่าโฟลเดอร์ "TOPUP" มีอยู่หรือไม่
            ftp.list('/', (err, list) => {
                if (err) {
                    console.error("Error occurred while checking folder:", err);
                    res.status(500).send("Internal Server Error");
                    return;
                }

                // ตรวจสอบว่าโฟลเดอร์ "TOPUP" มีอยู่หรือไม่
                const folderExists = list.some(item => item.type === 'd' && item.name === folderName);

                // ถ้าโฟลเดอร์ยังไม่มีอยู่ ให้สร้างโฟลเดอร์ "TOPUP" ก่อน
                if (!folderExists) {
                    ftp.mkdir(folderName, (err) => {
                        if (err) {
                            console.error("Error occurred while creating folder:", err);
                            res.status(500).send("Internal Server Error");
                            return;
                        }

                        console.log("Folder creation successful:", folderName);
                        // ทำการสร้างไฟล์ JSON หลังจากสร้างโฟลเดอร์เสร็จสิ้น
                        createJsonFile();
                    });
                } else {
                    // ถ้าโฟลเดอร์ "TOPUP" มีอยู่แล้ว ให้ทำการสร้างไฟล์ JSON ทันที
                    createJsonFile();
                }
            });
        });

        function updateJsonFile(){
            ftp.get(filename, (err, stream) => {
                if (err) {
                    //console.error("Error occurred while reading file:", err);
                    //res.status(500).send("Internal Server Error");
                    res.status(200).send("Not member, please sign up first")
                    return;
                }
    
                let data = '';
    
                stream.on('data', chunk => {
                    data += chunk.toString(); // เพิ่มข้อมูลที่ได้จาก stream ไปยังตัวแปร data
                });
    
                stream.on('end', () => {
                    try {
                        let jsonDataNew = JSON.parse(data); // แปลงข้อมูล JSON จาก string เป็น object
                        console.log(jsonDataNew);
                        jsonDataNew.transaction.push({
                            cash: cash,
                            timestamp: formattedCurrentDate
                        });
    
                        // แปลงข้อมูล JSON กลับเป็น string
                        const updatedData = JSON.stringify(jsonDataNew);
    
                        // เขียนข้อมูลลงในไฟล์บน FTP server
                        ftp.put(Buffer.from(updatedData), filename, (err) => {
                            if (err) {
                                console.error("Error occurred while updating file:", err);
                                res.status(500).send("Internal Server Error");
                            } else {
                                console.log(`Update data ${filename} successfully`);
                                res.status(200).json(jsonDataNew); // ส่งข้อมูล JSON กลับไปยังผู้ใช้
                            }
                            ftp.end(); // ปิดการเชื่อมต่อ FTP
                        });
                    } catch (error) {
                        console.error("Error occurred while parsing JSON:", error);
                        res.status(500).send("Internal Server Error");
                    }
                });
            });
        }

        function createJsonFile() {
            ftp.size(filename, (err, size) => {
                const jsonString = JSON.stringify(jsonData); // แปลงข้อมูล JSON เป็น string
                if (!err) {
                    updateJsonFile();
                    return;
                }

                ftp.put(Buffer.from(jsonString), filename, (err) => {
                    if (err) {
                        console.error("Error occurred while writing JSON file:", err);
                        res.status(500).send("Internal Server Error");
                    } else {
                        console.log("Write successful:", filename);
                        ftp.end(); // ปิดการเชื่อมต่อ FTP
                        res.status(200).send("Write successful");
                    }
                });
            });
        }
    } catch (error) {
        console.error("Error occurred:", error);
        res.status(500).send("Internal Server Error");
    }
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});