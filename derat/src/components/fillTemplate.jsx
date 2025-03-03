import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export const fillTemplate = async (templateUrl, request) => {
  try {
    // Fetch and load the existing PDF template
    const response = await fetch(templateUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch PDF template: ${response.statusText}`);
    }

    const existingPdfBytes = await response.arrayBuffer();

    console.log('PDF Bytes Length:', existingPdfBytes.byteLength);

    // Ensure the PDF file has a valid header
    const fileHeader = new Uint8Array(existingPdfBytes.slice(0, 4));
    const headerString = String.fromCharCode.apply(null, fileHeader);
    if (headerString !== '%PDF') {
      throw new Error(`Invalid PDF header: ${headerString}`);
    }

    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    // Get the first page of the document
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSize = 11;

    // Function to draw text in the PDF
    const drawText = (text, x, y, color = rgb(0, 0, 0)) => {
      firstPage.drawText(text, {
        x,
        y,
        size: fontSize,
        font,
        color,
      });
    };

    console.log('Request data in fillTemplate:', request);

    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).replace(/\//g, '.');
    const formattedTime = now.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    drawText(`${request.receptionNumber}`, 505, height - 112);
    drawText(`${formattedDate}`, 400, height - 135);
    drawText(`${formattedTime}`, 475, height - 135);
    drawText(`${request.client.name}`, 200, height - 180);
    drawText(`${request.client.contract_number}`, 525, height - 180);
    drawText(`${request.client.location}`, 250, height - 202);

    drawText(` ${request.clientRepresentative}`, 140, height - 520);

    // Embed and draw the client representative's signature
    if (request.clientSignature) {
      const clientSignatureImage = await pdfDoc.embedPng(request.clientSignature);
      firstPage.drawImage(clientSignatureImage, {
        x: 80,
        y: height - 550,
        width: 150,
        height: 50,
      });
    } else {
      drawText(`Client Signature: Not provided`, 580, height - 520);
    }

    // Draw employee information in blue
    const blueGreenColor = rgb(0, 0.1, 0.3);
    drawText(` ${request.employeeName}`, 525, height - 522, blueGreenColor);
    drawText(` ${request.employeeIDSeries}`, 540, height - 532, blueGreenColor); // Add ID series

    // Embed and draw the employee's signature
    if (request.employeeSignature) {
      const employeeSignatureImage = await pdfDoc.embedPng(request.employeeSignature);
      firstPage.drawImage(employeeSignatureImage, {
        x: 530,
        y: height - 580,
        width: 150,
        height: 50,
      });
    } else {
      drawText(`Employee Signature: Not provided`, 50, height - 490);
    }

    // Coordinates for procedures checkboxes
    const procedureCoordinates = {
      'deratizare': 0,
      'dezinsectie': 1,
      'dezinsectie2': 2,
      'dezinfectie': 3,
    };

    for (const operation of request.operations) {
      const coordinate = procedureCoordinates[operation.name];
      console.log(operation.name, coordinate);

      let yPosition = 365 - coordinate * 22;
      drawText('X', 130, yPosition);

      const surfaceXPosition = 180;
      const solutionXPosition = 200;
      const quantityXPosition = solutionXPosition + 110;
      const concentrationXPosition = quantityXPosition + 105;
      const lotXPosition = concentrationXPosition + 135;

      drawText(`${operation.surface} mp`, surfaceXPosition, yPosition);
      drawText(`${operation.solution}`, solutionXPosition, yPosition);
      drawText(`${parseFloat(operation.quantity).toFixed(4)} ml`, quantityXPosition, yPosition);
      drawText(`${operation.concentration}%`, concentrationXPosition, yPosition);
      drawText(`${operation.lot}`, lotXPosition, yPosition);
    }

    // Save the PDF document and return the bytes
    const pdfBytes = await pdfDoc.save();
    console.log('Generated PDF Bytes Length:', pdfBytes.length);
    return pdfBytes;
  } catch (error) {
    console.error('Error filling template:', error);
    throw error;
  }
};