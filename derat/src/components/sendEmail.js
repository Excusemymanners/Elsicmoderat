import axios from 'axios';

export const sendEmail = async (pdfBytes, clientEmail) => {
  try {
    // Convertește byte-urile PDF într-un șir base64
    const base64Pdf = btoa(String.fromCharCode(...new Uint8Array(pdfBytes)));

    // Definește conținutul emailului
    const emailContent = {
      to: clientEmail,
      subject: 'Proces Verbal',
      text: 'Please find the attached Proces Verbal.',
      attachment: base64Pdf,
    };

    // Trimite emailul folosind o cerere HTTP POST la endpoint-ul serverless
    const response = await axios.post('/api/send-email', emailContent);
    console.log('Email trimis:', response.data);
  } catch (error) {
    console.error('Eroare la trimiterea emailului:', error);
    throw error;
  }
};