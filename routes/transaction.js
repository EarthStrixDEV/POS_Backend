const express = require('express')
const ftpClient = require('ftp')
const router = express.Router()
const axios = require('axios');
const fs = require('fs');
const path = require('path');

require('dotenv').config()

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

app.post('/topUpCashCard', async(req, res) => {
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
            host: process.env.HOST, // เปลี่ยนเป็น host ของ FTP server ของคุณ
            user: process.env.USER,
            password: process.env.PASSWORD
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
                    // ถ้าโฟลเดอร์ "Nisit" มีอยู่แล้ว ให้ทำการสร้างไฟล์ JSON ทันที
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

app.post('/createTransactionPayment', async(req, res) => {
    const ftp = new ftpClient();
    
    try {
        let uuid = await callUUID();
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
        const filename = folderName + '/' + `${uuid.cardID}.json`; // ระบุพาธของไฟล์ที่รวมถึงชื่อโฟลเดอร์

        ftp.connect({
            host: process.env.HOST, // เปลี่ยนเป็น host ของ FTP server ของคุณ
            user: process.env.USER,
            password: process.env.PASSWORD
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

app.post('/createTransactionTopUp', async(req, res) => {
    const ftp = new ftpClient();
    
    try {
        let uuid = await callUUID();
        const cash = req.body.cash;

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
        const filename = folderName + '/' + `${uuid.cardID}.json`; // ระบุพาธของไฟล์ที่รวมถึงชื่อโฟลเดอร์

        ftp.connect({
            host: process.env.HOST, // เปลี่ยนเป็น host ของ FTP server ของคุณ
            user: process.env.USER,
            password: process.env.PASSWORD
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

module.exports = router