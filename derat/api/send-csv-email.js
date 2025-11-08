import nodemailer from 'nodemailer';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { csvContent, recipientEmail } = req.body;

        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: false,
            auth: {
                user: process.env.SMTP_EMAIL,
                pass: process.env.SMTP_PASSWORD
            }
        });

        const mailOptions = {
            from: process.env.SMTP_EMAIL,
            to: recipientEmail,
            subject: 'Baza de Date - Export Lucrări',
            text: 'Bună ziua!\n\nAtașat găsiți exportul bazei de date cu toate lucrările.\n\nCu stimă,\nElsiCom SRL',
            attachments: [
                {
                    filename: `lucrari_export_${new Date().toISOString().split('T')[0]}.csv`,
                    content: csvContent,
                    contentType: 'text/csv;charset=utf-8'
                }
            ]
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('CSV email sent successfully:', info.messageId);

        return res.status(200).json({ success: true, messageId: info.messageId });
    } catch (error) {
        console.error('Error sending CSV email:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
