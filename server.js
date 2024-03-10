const express = require('express');
const cors = require('cors');
const ftpClient = require('ftp');
const nodemailer = require('nodemailer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const app = express();

require('dotenv').config()

const transaction = require('./routes/transaction');
const user = require('./routes/user');

app.use(cors());
app.use(express.json()); // เพิ่ม middleware เพื่อให้ Express สามารถอ่านข้อมูล JSON จาก body ของ request ได้
app.use(express.urlencoded({extended: true}));

app.use('/user',user)
app.use('/transaction',transaction)

const callUUID = async () => {
    try {
        const response = await axios.get('http://127.0.0.1:8000/');
        console.log(response.data);
        return response.data;
    } catch (error) {
        console.log(error);
        throw error; // ส่ง error ออกไปให้ catch ด้านนอกจัดการ
    }
};

// อ่านข้อมูลลงใน ftp server
app.get('/readFileFromFTP/:filename', (req, res) => {
    const ftp = new ftpClient();
    ftp.connect({
        host: process.env.HOST, // เปลี่ยนเป็น host ของ FTP server ของคุณ
        user: process.env.USER,
        password: process.env.PASSWORD
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
        host: process.env.HOST, // เปลี่ยนเป็น host ของ FTP server ของคุณ
        user: process.env.USER,
        password: process.env.PASSWORD
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
                    console.log("Write successful.");
                    ftp.end(); // ปิดการเชื่อมต่อ FTP
                    res.status(200).send("Write successful.");
                }
            });
        });
    });
});

app.post('/writeJsonFileToFolderNisitInFTP', async(req, res) => {
    const ftp = new ftpClient();
    
    try {
        let uuid = await callUUID();

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

        const folderName = 'Nisit'; // ชื่อโฟลเดอร์ที่ต้องการสร้างไฟล์ JSON ในนี้
        const filename = folderName + '/' + `${uuid.cardID}.json`; // ระบุพาธของไฟล์ที่รวมถึงชื่อโฟลเดอร์

        ftp.connect({
            host: process.env.HOST, // เปลี่ยนเป็น host ของ FTP server ของคุณ
            user: process.env.USER,
            password: process.env.PASSWORD
        });

        ftp.on('ready', () => {
            // ตรวจสอบว่าโฟลเดอร์ "Nisit" มีอยู่หรือไม่
            ftp.list('/', (err, list) => {
                if (err) {
                    console.error("Error occurred while checking folder:", err);
                    res.status(500).send("Internal Server Error");
                    return;
                }

                // ตรวจสอบว่าโฟลเดอร์ "Nisit" มีอยู่หรือไม่
                const folderExists = list.some(item => item.type === 'd' && item.name === folderName);

                // ถ้าโฟลเดอร์ยังไม่มีอยู่ ให้สร้างโฟลเดอร์ "Nisit" ก่อน
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
                    // ถ้าโฟลเดอร์ "Nisit" มีอยู่แล้ว ให้ทำการสร้างไฟล์ JSON ทันที
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
                        res.status(200).send("Write successful.");
                    }
                });
            });
        }
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
        ftp.connect({
            host: process.env.HOST, // เปลี่ยนเป็น host ของ FTP server ของคุณ
            user: process.env.USER,
            password: process.env.PASSWORD
        });
    
        ftp.on('ready', () => {
            const folderName = 'Nisit';
            const filename = folderName + `/${uuid.cardID}.json`; // ระบุพาธของไฟล์ที่รวมถึงชื่อโฟลเดอร์และชื่อไฟล์
    
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
                        let point = cash * 5 / 100; // ได้แต้ม 5% จากราคาชำระ
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
        host: process.env.HOST, // เปลี่ยนเป็น host ของ FTP server ของคุณ
        user: process.env.USER,
        password: process.env.PASSWORD
    });

    ftp.on('ready', () => {
        ftp.list('/Nisit', (err, list) => {
            if (err) {
                console.error("Error occurred while listing files:", err);
                res.status(500).send("Internal Server Error");
                return;
            }
        
            // วนลูปผ่านรายการไฟล์ในโฟลเดอร์ "Nisit"
            for (let i = 0; i < list.length; i++) {
                const item = list[i];
                // ตรวจสอบว่าไฟล์นี้เป็นไฟล์ที่ต้องการหรือไม่
                if (item.type === '-') { // ตรวจสอบว่าเป็นไฟล์ (ไม่ใช่โฟลเดอร์)
                    const filename = item.name;
                    const filepath = '/Nisit/' + filename;
        
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
                                res.send(parsedData);
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

        ftp.connect({
            host: process.env.HOST, // เปลี่ยนเป็น host ของ FTP server ของคุณ
            user: process.env.USER,
            password: process.env.PASSWORD
        });
    
        ftp.on('ready', () => {
            const folderName = 'Nisit';
            const filename = folderName + `/${uuid.cardID}.json`; // ระบุพาธของไฟล์ที่รวมถึงชื่อโฟลเดอร์และชื่อไฟล์
    
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

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});