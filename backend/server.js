const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const port = 3001;

app.use(cors());
app.use(bodyParser.json());

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: '1285849adm@gmail.com',
        pass: 'pwcl whca wkuz eess'  // Utilizează parola de aplicație aici
    }
});

app.post('/send-email', (req, res) => {
    const { to, subject, text, attachment } = req.body;

    const mailOptions = {
        from: '1285849adm@gmail.com',
        to,
        subject,
        text,
        attachments: [
            {
                filename: 'proces-verbal.pdf',
                content: attachment,
                encoding: 'base64'
            }
        ]
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Eroare la trimiterea emailului:', error);
            return res.status(500).send(error.toString());
        }
        res.status(200).send('Email trimis: ' + info.response);
    });
});

app.listen(port, () => {
    console.log(`Serverul rulează la http://localhost:${port}`);
});