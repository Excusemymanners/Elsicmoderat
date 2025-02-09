import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export const fillTemplate = async (templateUrl, formData) => {
  try {
    // Fetch and load the existing PDF template
    const response = await fetch(templateUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch PDF template: ${response.statusText}`);
    }

    const existingPdfBytes = await response.arrayBuffer();

    console.log('PDF Bytes Length:', existingPdfBytes.byteLength);

    // Asigură-te că fișierul PDF are un antet valid
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

    console.log('Form Data in fillTemplate:', formData);

    // Draw the information in the PDF at specified positions
    drawText(` ${formData.receptionNumber}`, 505, height - 112);
    drawText(` ${formData.date}`, 400, height - 135);
    drawText(`${formData.time}`, 475, height - 135);
    drawText(` ${formData.customer.name}`, 200, height - 180);
    drawText(` ${formData.customer.contract_number}`, 525, height - 180);
    drawText(` ${formData.customer.location}`, 250, height - 202);
    drawText(`${formData.customer.surface} mp`, 220, height - 225);

    drawText(` ${formData.clientRepresentative}`, 140, height - 520);

    // Embed and draw the client representative's signature
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

    // Draw employee information in blue
    const blueGreenColor = rgb(0, 0.1, 0.3);
    drawText(` ${formData.employeeName}`, 525, height - 522, blueGreenColor);
    drawText(` ${formData.employeeIDSeries}`, 540, height - 532, blueGreenColor); // Add ID series
    

    // Embed and draw the employee's signature
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

    // Coordinates for procedures checkboxes (example coordinates)
    const procedureCoordinates = {
      Dezinfectare: { x: 130, y: height - 270 },
      Dezinsectare: { x: 130, y: height - 290 },
      Deratizare: { x: 130, y: height - 315 },
      // Add more procedures as needed
    };

    // Iterate over selected procedures and mark them with 'X'
    formData.operations.forEach(operation => {
      if (procedureCoordinates[operation]) {
        const { x, y } = procedureCoordinates[operation];
        drawText('X', x, y);
      }
    });

    // Coordinates for solutions (example coordinates)
    let solutionYPosition = height - 270;
    const solutionXPosition = 180;
    const quantityXPosition = solutionXPosition + 110; // Position quantities to the right of solutions
    const concentrationXPosition = quantityXPosition + 145; // Position concentrations to the right of quantities
    const lotXPosition = concentrationXPosition + 60; // Position lot to the right of concentrations

    // Iterate over selected solutions and add them to the PDF
    Object.keys(formData.solutions).forEach(operation => {
      formData.solutions[operation]?.forEach(solution => {
        drawText(` ${solution.label}`, solutionXPosition, solutionYPosition);
        const quantityUsed = formData.quantities[operation]; // Get the quantity used for this operation
        drawText(`${quantityUsed} ${solution.unit_of_measure}`, quantityXPosition, solutionYPosition);
        drawText(`${solution.concentration}%`, concentrationXPosition, solutionYPosition);
        drawText(`${solution.lot}`, lotXPosition, solutionYPosition);
        solutionYPosition -= 22; // Adjust the position for the next solution
      });
    });

    // Save the PDF document and return the bytes
    const pdfBytes = await pdfDoc.save();
    console.log('Generated PDF Bytes Length:', pdfBytes.length);
    return pdfBytes;
  } catch (error) {
    console.error('Error filling template:', error);
    throw error;
  }
};