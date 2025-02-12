import nodemailer from 'nodemailer';
import settings from '../../settings.json' assert { type: "json" };

export const sendEmail = async (pdfBytes, clientEmail) => {
    try {
        const transporter = nodemailer.createTransport({
        host: settings.smtpHost,
        port: settings.smtpPort,
        secure: false,
            auth: {
                user: settings.smtpEmail,
                pass: settings.smtpPassword
            }
        });

        // Convert object to array
        const byteArray = Object.values(pdfBytes);
        
        // Convert array to Buffer
        const pdfBuffer = Buffer.from(byteArray);

        const mailOptions = {
        from: settings.smtpEmail,
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
        return info;
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
};