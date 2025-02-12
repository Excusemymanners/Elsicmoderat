import nodemailer from 'nodemailer';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { pdfBytes, clientEmail } = req.body;
        
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: false,
            auth: {
                user: process.env.SMTP_EMAIL,
                pass: process.env.SMTP_PASSWORD
            }
        });

        // Rest of your email sending code remains the same
        const byteArray = Object.values(pdfBytes);
        const pdfBuffer = Buffer.from(byteArray);

        const mailOptions = {
            from: process.env.SMTP_EMAIL,
            to: 'lookitup.srl@gmail.com',
            subject: 'Proces Verbal',
            text: 'Please find the attached Proces Verbal.',
            attachments: [
                {
                    filename: 'proces-verbal.pdf',
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                }
            ]
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', info.messageId);
        
        return res.status(200).json({ success: true, messageId: info.messageId });
    } catch (error) {
        console.error('Error sending email:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}