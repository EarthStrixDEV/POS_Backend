const express = require('express')
const ftpClient = require('ftp')
const router = express.Router()
const axios = require('axios');
const fs = require('fs');
const path = require('path');

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

router.post('/userRegistration' ,(request ,response) => {
    const {card_ID ,student_ID ,student_name ,email} = request.body
    const [firstName ,lastName] = student_name.split(' ')
    const ftp = new ftpClient();

    const jsonData = {
        card_ID: card_ID,
        studentID: student_ID,
        firstName: firstName,
        lastName: lastName,
        point: point,
        email: email
    };

    const folderName = 'Nisit'; // ชื่อโฟลเดอร์ที่ต้องการสร้างไฟล์ JSON ในนี้
    const filename = folderName + '/' + `${uuid.cardID}.json`; // ระบุพาธของไฟล์ที่รวมถึงชื่อโฟลเดอร์

    ftp.connect({
        host: '127.0.0.1', // เปลี่ยนเป็น host ของ FTP server ของคุณ
        user: 'chayanon',
        password: '0816538747'
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
})

router.get('/getUser/:student_ID', (request ,response) => {
    const id = request.params.student_ID
    
    const ftp = new ftpClient();
    ftp.connect({
        host: '127.0.0.1', // เปลี่ยนเป็น host ของ FTP server ของคุณ
        user: 'chayanon',
        password: '0816538747'
    });

    ftp.on('ready', () => {
        const filename = id; // รับชื่อไฟล์จาก parameter ใน URL

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
                    response.send(data)
                });
            }
        });
    });
})

module.exports = router