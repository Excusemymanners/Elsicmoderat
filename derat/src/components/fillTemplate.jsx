import { PDFDocument, rgb } from 'pdf-lib';
import download from 'downloadjs';

const fillTemplate = async ({ formData }) => {
  const existingPdfBytes = await fetch('/assets/template.pdf').then(res => res.arrayBuffer());

  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];

  // Adaugă detalii angajat
  firstPage.drawText(`Name: ${formData.employeeName}`, { x: 20, y: 750, size: 12, color: rgb(0, 0, 0) });
  firstPage.drawText(`ID Series: ${formData.employeeIDSeries}`, { x: 20, y: 730, size: 12, color: rgb(0, 0, 0) });
  firstPage.drawText(`ID Number: ${formData.employeeIDNumber}`, { x: 20, y: 710, size: 12, color: rgb(0, 0, 0) });

  // Adaugă detalii client
  firstPage.drawText(`Name: ${formData.customer.name}`, { x: 20, y: 690, size: 12, color: rgb(0, 0, 0) });
  firstPage.drawText(`Email: ${formData.customer.email}`, { x: 20, y: 670, size: 12, color: rgb(0, 0, 0) });
  firstPage.drawText(`Phone: ${formData.customer.phone}`, { x: 20, y: 650, size: 12, color: rgb(0, 0, 0) });
  firstPage.drawText(`Contract Number: ${formData.customer.contract_number}`, { x: 20, y: 630, size: 12, color: rgb(0, 0, 0) });
  firstPage.drawText(`Location: ${formData.customer.location}`, { x: 20, y: 610, size: 12, color: rgb(0, 0, 0) });

  // Adaugă operațiuni selectate
  firstPage.drawText('Selected Operations:', { x: 20, y: 590, size: 12, color: rgb(0, 0, 0) });
  formData.operations.forEach((operation, index) => {
    firstPage.drawText(`Operation: ${operation}`, { x: 20, y: 570 - index * 20, size: 12, color: rgb(0, 0, 0) });
    formData.solutions[operation].forEach((solution, i) => {
      firstPage.drawText(`Solution: ${solution.label}, Quantity: ${formData.quantities[operation]} ${solution.unit_of_measure}`, { x: 40, y: 550 - index * 20 - i * 20, size: 12, color: rgb(0, 0, 0) });
    });
  });

  // Adaugă reprezentantul clientului
  firstPage.drawText(`Client Representative: ${formData.clientRepresentative}`, { x: 20, y: 450, size: 12, color: rgb(0, 0, 0) });

  // Adaugă semnătura clientului
  if (formData.clientSignature) {
    const clientSignatureImage = await pdfDoc.embedPng(formData.clientSignature);
    firstPage.drawImage(clientSignatureImage, {
      x: 20,
      y: 400,
      width: 100,
      height: 50,
    });
  }

  // Adaugă semnătura angajatului
  if (formData.employeeSignature) {
    const employeeSignatureImage = await pdfDoc.embedPng(formData.employeeSignature);
    firstPage.drawImage(employeeSignatureImage, {
      x: 20,
      y: 330,
      width: 100,
      height: 50,
    });
  }

  const pdfBytes = await pdfDoc.save();
  download(pdfBytes, 'summary_and_signature.pdf', 'application/pdf');
};

export default fillTemplate;