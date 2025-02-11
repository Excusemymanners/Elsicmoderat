import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export const fillTemplate = async (templateUrl, formData) => {
  try {
    const response = await fetch(templateUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch PDF template: ${response.statusText}`);
    }

    const existingPdfBytes = await response.arrayBuffer();

    const fileHeader = new Uint8Array(existingPdfBytes.slice(0, 4));
    const headerString = String.fromCharCode.apply(null, fileHeader);
    if (headerString !== '%PDF') {
      throw new Error(`Invalid PDF header: ${headerString}`);
    }

    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSize = 11;

    const drawText = (text, x, y, color = rgb(0, 0, 0)) => {
      firstPage.drawText(text, {
        x,
        y,
        size: fontSize,
        font,
        color,
      });
    };

    drawText(` ${formData.receptionNumber}`, 505, height - 112);
    drawText(` ${formData.date}`, 400, height - 135);
    drawText(`${formData.time}`, 475, height - 135);
    drawText(` ${formData.customer.name}`, 200, height - 180);
    drawText(` ${formData.customer.contract_number}`, 525, height - 180);
    drawText(` ${formData.customer.location}`, 250, height - 202);
    drawText(`${formData.customer.surface} mp`, 220, height - 225);
    drawText(` ${formData.clientRepresentative}`, 140, height - 520);

    if (formData.clientSignature) {
      const clientSignatureImage = await pdfDoc.embedPng(formData.clientSignature);
      firstPage.drawImage(clientSignatureImage, {
        x: 80,
        y: height - 550,
        width: 150,
        height: 50,
      });
    } else {
      drawText(`Client Signature: Not provided`, 580, height - 520);
    }

    const blueGreenColor = rgb(0, 0.1, 0.3);
    drawText(` ${formData.employeeName}`, 525, height - 522, blueGreenColor);
    drawText(` ${formData.employeeIDSeries}`, 540, height - 532, blueGreenColor);

    if (formData.employeeSignature) {
      const employeeSignatureImage = await pdfDoc.embedPng(formData.employeeSignature);
      firstPage.drawImage(employeeSignatureImage, {
        x: 530,
        y: height - 580,
        width: 150,
        height: 50,
      });
    } else {
      drawText(`Employee Signature: Not provided`, 50, height - 490);
    }

    const procedureCoordinates = {
      Dezinfectare: { x: 130, y: height - 270 },
      Dezinsectare: { x: 130, y: height - 290 },
      Deratizare: { x: 130, y: height - 315 },
    };

    formData.operations.forEach(operation => {
      if (procedureCoordinates[operation]) {
        const { x, y } = procedureCoordinates[operation];
        drawText('X', x, y);
      }
    });

    let solutionYPosition = height - 270;
    const solutionXPosition = 180;
    const quantityXPosition = solutionXPosition + 110;
    const concentrationXPosition = quantityXPosition + 145;
    const lotXPosition = concentrationXPosition + 70;

    Object.keys(formData.solutions).forEach(operation => {
      formData.solutions[operation]?.forEach(solution => {
        drawText(` ${solution.label}`, solutionXPosition, solutionYPosition);
        const quantityUsed = formData.quantities[operation];
        drawText(`${quantityUsed} ${solution.unit_of_measure}`, quantityXPosition, solutionYPosition);
        drawText(`${solution.concentration}%`, concentrationXPosition, solutionYPosition);
        drawText(`${solution.lot}`, lotXPosition, solutionYPosition);
        solutionYPosition -= 22;
      });
    });

    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
  } catch (error) {
    console.error('Error filling template:', error);
    throw error;
  }
};